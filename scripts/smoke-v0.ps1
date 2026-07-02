param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$Username,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [switch]$AllowMissingExportTemplates
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Method,

    [Parameter(Mandatory = $true)]
    [string]$Path,

    [object]$Body,

    [hashtable]$Headers
  )

  $uri = "$BaseUrl$Path"
  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers
  }

  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 30)
}

function Assert-Condition {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

$BaseUrl = $BaseUrl.TrimEnd("/")

Write-Host "PAS V0 smoke: login"
$login = Invoke-Json -Method "Post" -Path "/api/auth/login" -Body @{
  username = $Username
  password = $Password
}
Assert-Condition ($login.accessToken) "Login did not return accessToken"
$headers = @{ Authorization = "Bearer $($login.accessToken)" }

Write-Host "PAS V0 smoke: /api/me"
$me = Invoke-Json -Method "Get" -Path "/api/me" -Headers $headers
Assert-Condition ($me.username -eq $login.user.username) "/api/me user mismatch"

Write-Host "PAS V0 smoke: RAGFlow health"
$ragflow = Invoke-Json -Method "Get" -Path "/api/ragflow/health"
Assert-Condition ($ragflow.status -in @("ok", "disabled", "error")) "Unexpected RAGFlow health response"

Write-Host "PAS V0 smoke: CRM mock customers"
$customers = Invoke-Json -Method "Get" -Path "/api/crm/customers"
Assert-Condition ($customers.Count -gt 0) "CRM customers empty"
$customerId = $customers[0].customerId

Write-Host "PAS V0 smoke: QA"
$qa = Invoke-Json -Method "Post" -Path "/api/internal/qa/ask" -Headers $headers -Body @{
  query = "How does IP-Guard protect outbound files?"
  userId = $me.userId
}
Assert-Condition ($qa.status -in @("answered", "no_hit")) "QA failed"

Write-Host "PAS V0 smoke: customer analysis"
$analysis = Invoke-Json -Method "Post" -Path "/api/internal/customer-analysis/analyze" -Headers $headers -Body @{
  customerId = $customerId
  userId = $me.userId
}
Assert-Condition ($analysis.status -eq "completed") "Customer analysis failed"

Write-Host "PAS V0 smoke: proposal generation"
$proposalJob = Invoke-Json -Method "Post" -Path "/api/internal/proposals/generate" -Headers $headers -Body @{
  customerId = $customerId
  userId = $me.userId
}
Assert-Condition ($proposalJob.status -eq "completed") "Proposal generation failed"
Assert-Condition ($proposalJob.exportPackage) "Proposal did not return exportPackage"

Write-Host "PAS V0 smoke: export"
$exportJob = Invoke-Json -Method "Post" -Path "/api/internal/exports" -Headers $headers -Body @{
  exportPackage = $proposalJob.exportPackage
  userId = $me.userId
}
if ($exportJob.status -ne "completed") {
  $missingTemplatesOnly = $true
  foreach ($format in $exportJob.formats) {
    if ($format.status -ne "failed" -or $format.failureReason -ne "TEMPLATE_MISSING") {
      $missingTemplatesOnly = $false
    }
  }

  if (-not ($AllowMissingExportTemplates -and $missingTemplatesOnly)) {
    throw "Export did not complete. Use -AllowMissingExportTemplates only before approved templates are installed."
  }
}

Write-Host "PAS V0 smoke: feedback"
$feedback = Invoke-Json -Method "Post" -Path "/api/internal/feedback" -Headers $headers -Body @{
  objectType = "qa_answer"
  objectId = $qa.questionId
  rating = 3
  issueType = "other"
  comment = "Smoke feedback"
}
Assert-Condition ($feedback.status -eq "open") "Feedback submit failed"

Write-Host "PAS V0 smoke passed"
