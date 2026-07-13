[CmdletBinding()]
param(
  [string]$EnvFile = (Join-Path (Split-Path -Parent $PSScriptRoot) ".env")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $repoRoot "docker-compose.yml"
$crmBaseUrl = "https://demo.sworditsys.com/api/v1"
$backendContainer = "HYYN-backend"
$crmEnvironmentNames = @("CRM_CLIENT_MODE", "CRM_BASE_URL", "CRM_API_TOKEN")

if ($null -eq ("PasAtomicFile" -as [type])) {
  Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;

public static class PasAtomicFile
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool MoveFileEx(string existingPath, string newPath, int flags);
}
"@
}

function Get-CrmToken {
  $plainText = [Environment]::GetEnvironmentVariable("PAS_CRM_TOKEN_ROTATION_VALUE", "Process")
  if (-not [string]::IsNullOrWhiteSpace($plainText)) {
    [Environment]::SetEnvironmentVariable("PAS_CRM_TOKEN_ROTATION_VALUE", $null, "Process")
    return $plainText.Trim()
  }

  $secureToken = Read-Host "Enter the new CRM API token" -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
  try {
    return ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)).Trim()
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Test-CrmToken {
  param([string]$Token)

  try {
    $response = Invoke-RestMethod `
      -Method Get `
      -Uri "$crmBaseUrl/users/options" `
      -Headers @{ Accept = "application/json"; Authorization = "Bearer $Token" } `
      -MaximumRedirection 0 `
      -TimeoutSec 15
  } catch {
    throw "The CRM rejected the token or the read-only validation endpoint is unavailable."
  }

  if ($null -eq $response) {
    throw "The CRM validation response is invalid."
  }
  $dataProperty = $response.PSObject.Properties["data"]
  if ($null -eq $dataProperty -or $dataProperty.Value -is [string] -or $dataProperty.Value -isnot [System.Collections.IEnumerable]) {
    throw "The CRM validation response is invalid."
  }
}

function Assert-EnvFileIgnored {
  param([string]$Path)

  $envDirectory = Split-Path -Parent $Path
  & git -C $envDirectory check-ignore --quiet -- $Path *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "The deployment env file must be ignored by Git before it can store a CRM token."
  }
}

function Update-EnvContent {
  param(
    [string]$Content,
    [System.Collections.IDictionary]$Values
  )

  $result = $Content
  $newLine = if ($Content.Contains("`r`n")) { "`r`n" } else { "`n" }

  foreach ($key in $Values.Keys) {
    $pattern = "(?m)^(?<prefix>[ `t]*$([regex]::Escape([string]$key))[ `t]*=)[^`r`n]*(?<suffix>`r?)$"
    $regex = [regex]::new($pattern)
    $matches = $regex.Matches($result)
    if ($matches.Count -gt 1) {
      throw "The deployment env file contains duplicate $key entries."
    }

    $value = [string]$Values[$key]
    if ($matches.Count -eq 1) {
      $result = $regex.Replace(
        $result,
        { param($match) $match.Groups["prefix"].Value + $value + $match.Groups["suffix"].Value },
        1
      )
      continue
    }

    if ($result.Length -gt 0 -and -not $result.EndsWith("`n")) {
      $result += $newLine
    }
    $result += "$key=$value$newLine"
  }

  return $result
}

function Write-AtomicText {
  param(
    [string]$Path,
    [string]$Content
  )

  $directory = Split-Path -Parent $Path
  $fileName = Split-Path -Leaf $Path
  $temporaryPath = Join-Path $directory ".$fileName.$([guid]::NewGuid().ToString('N')).tmp"
  $accessControl = Get-Acl -LiteralPath $Path
  $replaceExistingAndWriteThrough = 0x1 -bor 0x8
  try {
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($temporaryPath, $Content, $encoding)
    Set-Acl -LiteralPath $temporaryPath -AclObject $accessControl
    if (-not [PasAtomicFile]::MoveFileEx($temporaryPath, $Path, $replaceExistingAndWriteThrough)) {
      $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      throw (New-Object ComponentModel.Win32Exception($errorCode))
    }
  } finally {
    if (Test-Path -LiteralPath $temporaryPath) {
      Remove-Item -LiteralPath $temporaryPath -Force
    }
  }
}

function Get-DockerExecutable {
  $command = Get-Command docker -ErrorAction SilentlyContinue
  if ($null -ne $command) {
    return $command.Source
  }

  $fallback = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
  if (Test-Path -LiteralPath $fallback) {
    return $fallback
  }

  throw "Docker CLI was not found."
}

function Invoke-Docker {
  param(
    [string]$Executable,
    [string[]]$Arguments,
    [string]$FailureMessage
  )

  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = @(& $Executable @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -ne 0) {
    throw $FailureMessage
  }
  return $output
}

function Get-ContainerEnvValue {
  param(
    [string]$Docker,
    [string]$Container,
    [string]$Name
  )

  $lines = @(Invoke-Docker `
    -Executable $Docker `
    -Arguments @("inspect", "--format", "{{range .Config.Env}}{{println .}}{{end}}", $Container) `
    -FailureMessage "The running PAS backend container could not be inspected.")
  $prefix = "$Name="
  foreach ($line in $lines) {
    $text = [string]$line
    if ($text.StartsWith($prefix, [StringComparison]::Ordinal)) {
      return $text.Substring($prefix.Length)
    }
  }
  return $null
}

function Wait-BackendHealthy {
  param([string]$Docker)

  $deadline = [DateTime]::UtcNow.AddSeconds(90)
  do {
    $output = @(Invoke-Docker `
      -Executable $Docker `
      -Arguments @("inspect", "--format", "{{.State.Health.Status}}", $backendContainer) `
      -FailureMessage "The PAS backend container could not be inspected after restart.")
    $status = ([string]::Join("", $output)).Trim()
    if ($status -eq "healthy") {
      return
    }
    if ($status -eq "unhealthy") {
      throw "The PAS backend became unhealthy after restart."
    }
    Start-Sleep -Seconds 2
  } while ([DateTime]::UtcNow -lt $deadline)

  throw "Timed out waiting for the PAS backend health check."
}

function Invoke-BackendRecreate {
  param(
    [string]$Docker,
    [string]$ResolvedEnvFile
  )

  Invoke-Docker `
    -Executable $Docker `
    -Arguments @("compose", "--project-name", "pas-v2", "--env-file", $ResolvedEnvFile, "--file", $composeFile, "config", "--quiet") `
    -FailureMessage "Docker Compose rejected the updated deployment configuration." | Out-Null

  Invoke-Docker `
    -Executable $Docker `
    -Arguments @("compose", "--project-name", "pas-v2", "--env-file", $ResolvedEnvFile, "--file", $composeFile, "up", "-d", "--no-deps", "--force-recreate", "--no-build", "pas-backend") `
    -FailureMessage "Docker Compose could not recreate the PAS backend." | Out-Null

  Wait-BackendHealthy -Docker $Docker
}

function Set-ProcessEnvironment {
  param(
    [string]$Name,
    [AllowNull()][string]$Value
  )
  [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
}

function Get-SafeMessage {
  param(
    [Exception]$Exception,
    [AllowNull()][string]$Secret
  )

  $message = $Exception.Message
  if (-not [string]::IsNullOrEmpty($Secret)) {
    $message = $message.Replace($Secret, "[REDACTED]")
  }
  return $message
}

$token = $null
$originalContent = $null
$envUpdated = $false
$previousRuntime = [ordered]@{}
$originalProcessEnvironment = [ordered]@{}
foreach ($name in $crmEnvironmentNames) {
  $originalProcessEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

try {
  if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    throw "Deployment env file not found. Create .env from .env.example first."
  }
  $resolvedEnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
  Assert-EnvFileIgnored -Path $resolvedEnvFile
  $originalContent = [IO.File]::ReadAllText($resolvedEnvFile)

  $token = Get-CrmToken
  if ([string]::IsNullOrWhiteSpace($token) -or $token -notmatch "^[A-Za-z0-9._-]+$") {
    throw "CRM API token must contain only letters, numbers, dots, underscores, or hyphens."
  }

  $updatedContent = Update-EnvContent `
    -Content $originalContent `
    -Values ([ordered]@{
      CRM_CLIENT_MODE = "external"
      CRM_BASE_URL = $crmBaseUrl
      CRM_API_TOKEN = $token
    })

  Write-Host "Validating the token with read-only GET /users/options..."
  Test-CrmToken -Token $token
  Write-Host "Token validation passed."

  $docker = Get-DockerExecutable
  foreach ($name in $crmEnvironmentNames) {
    $previousRuntime[$name] = Get-ContainerEnvValue -Docker $docker -Container $backendContainer -Name $name
  }

  Write-AtomicText -Path $resolvedEnvFile -Content $updatedContent
  $envUpdated = $true
  Set-ProcessEnvironment -Name "CRM_CLIENT_MODE" -Value "external"
  Set-ProcessEnvironment -Name "CRM_BASE_URL" -Value $crmBaseUrl
  Set-ProcessEnvironment -Name "CRM_API_TOKEN" -Value $token

  Write-Host "Recreating only the PAS backend..."
  Invoke-BackendRecreate -Docker $docker -ResolvedEnvFile $resolvedEnvFile
  $activeToken = Get-ContainerEnvValue -Docker $docker -Container $backendContainer -Name "CRM_API_TOKEN"
  if ($activeToken -cne $token) {
    throw "The recreated PAS backend did not receive the new CRM token."
  }

  Write-Host "CRM token rotation completed; HYYN-backend is healthy."
} catch {
  $primaryMessage = Get-SafeMessage -Exception $_.Exception -Secret $token
  if ($envUpdated) {
    Write-Warning "Rotation failed after the env update; restoring the previous configuration."
    try {
      Write-AtomicText -Path $resolvedEnvFile -Content $originalContent
      foreach ($name in $crmEnvironmentNames) {
        Set-ProcessEnvironment -Name $name -Value $previousRuntime[$name]
      }
      Invoke-BackendRecreate -Docker $docker -ResolvedEnvFile $resolvedEnvFile
      $restoredToken = Get-ContainerEnvValue -Docker $docker -Container $backendContainer -Name "CRM_API_TOKEN"
      if ($restoredToken -cne $previousRuntime["CRM_API_TOKEN"]) {
        throw "The PAS backend did not restore the previous CRM token."
      }
      Write-Warning "The previous CRM configuration was restored."
    } catch {
      $rollbackMessage = Get-SafeMessage -Exception $_.Exception -Secret $token
      throw "CRM token rotation failed: $primaryMessage Automatic rollback also failed: $rollbackMessage"
    }
  }
  throw "CRM token rotation failed: $primaryMessage"
} finally {
  foreach ($name in $crmEnvironmentNames) {
    Set-ProcessEnvironment -Name $name -Value $originalProcessEnvironment[$name]
  }
  $token = $null
}
