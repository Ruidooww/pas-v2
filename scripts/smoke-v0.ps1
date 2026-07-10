param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$Username,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [switch]$AllowMissingExportTemplates,

  [string]$CandidateQuestionFile,

  [ValidateRange(1, 50)]
  [int]$CandidateQuestionLimit = 5
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

function Wait-ProposalJob {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Job,

    [Parameter(Mandatory = $true)]
    [hashtable]$Headers
  )

  Assert-Condition ([bool]$Job.jobId) "Proposal generation did not return jobId"
  $current = $Job
  for ($attempt = 0; $attempt -lt 60 -and $current.status -eq "running"; $attempt += 1) {
    Start-Sleep -Milliseconds 500
    $current = Invoke-Json -Method "Get" -Path "/api/internal/proposals/$($Job.jobId)" -Headers $Headers
  }

  if ($current.status -eq "running") {
    throw "Proposal generation timed out: jobId=$($Job.jobId)"
  }

  return $current
}

function Read-CandidateQuestions {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Candidate question file not found: $Path"
  }

  $questions = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
  if ($null -eq $questions -or $questions.Count -eq 0) {
    throw "Candidate question file is empty: $Path"
  }

  return @($questions)
}

function Invoke-CandidateQa {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Candidate,

    [Parameter(Mandatory = $true)]
    [string]$UserId,

    [Parameter(Mandatory = $true)]
    [hashtable]$Headers
  )

  for ($attempt = 1; $attempt -le 13; $attempt += 1) {
    try {
      return Invoke-Json -Method "Post" -Path "/api/internal/qa/ask" -Headers $Headers -Body @{
        query = $Candidate.question
        userId = $UserId
      }
    } catch {
      $statusCode = [int]$_.Exception.Response.StatusCode
      if ($statusCode -ne 429 -or $attempt -eq 13) {
        throw
      }

      $delaySeconds = 5
      $parsedDelay = 0
      $retryAfter = $_.Exception.Response.Headers["Retry-After"]
      if ([int]::TryParse($retryAfter, [ref]$parsedDelay) -and $parsedDelay -gt 0) {
        $delaySeconds = [Math]::Min($parsedDelay + 1, 60)
      }
      Write-Host "  $($Candidate.question_id): rate limited, retrying in $delaySeconds seconds"
      Start-Sleep -Seconds $delaySeconds
    }
  }
}

$BaseUrl = $BaseUrl.TrimEnd("/")

Write-Host "PAS V0 smoke: login"
$login = Invoke-Json -Method "Post" -Path "/api/auth/login" -Body @{
  username = $Username
  password = $Password
}
Assert-Condition ([bool]$login.accessToken) "Login did not return accessToken"
$headers = @{ Authorization = "Bearer $($login.accessToken)" }

Write-Host "PAS V0 smoke: /api/me"
$me = Invoke-Json -Method "Get" -Path "/api/me" -Headers $headers
Assert-Condition ($me.username -eq $login.user.username) "/api/me user mismatch"

Write-Host "PAS V0 smoke: RAGFlow health"
$ragflow = Invoke-Json -Method "Get" -Path "/api/ragflow/health"
Assert-Condition ($ragflow.status -in @("ok", "disabled")) "RAGFlow health failed: status=$($ragflow.status) kind=$($ragflow.errorKind) httpStatus=$($ragflow.httpStatus)"

Write-Host "PAS V0 smoke: CRM mock customers"
$customerList = Invoke-Json -Method "Get" -Path "/api/crm/customers" -Headers $headers
Assert-Condition ($customerList.customers.Count -gt 0) "CRM customers empty"
$customerId = $customerList.customers[0].customerId

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
$proposalJob = Wait-ProposalJob -Job $proposalJob -Headers $headers
Assert-Condition ($proposalJob.status -eq "completed") "Proposal generation failed: status=$($proposalJob.status) reason=$($proposalJob.failureReason)"
Assert-Condition ([bool]$proposalJob.exportPackage) "Proposal did not return exportPackage"

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

if ($CandidateQuestionFile) {
  Write-Host "PAS V0 smoke: candidate QA questions"
  $candidateQuestions = Read-CandidateQuestions -Path $CandidateQuestionFile | Select-Object -First $CandidateQuestionLimit
  $candidateQaSummary = @{
    answered = 0
    no_hit = 0
    error = 0
  }
  foreach ($candidate in $candidateQuestions) {
    Assert-Condition ([bool]$candidate.question_id) "Candidate question is missing question_id"
    Assert-Condition ([bool]$candidate.question) "Candidate question $($candidate.question_id) is missing question"
    $candidateQa = Invoke-CandidateQa -Candidate $candidate -UserId $me.userId -Headers $headers
    Assert-Condition ($candidateQa.status -in @("answered", "no_hit")) "Candidate QA failed: $($candidate.question_id) status=$($candidateQa.status)"
    $candidateQaSummary[$candidateQa.status] += 1
    Write-Host "  $($candidate.question_id): $($candidateQa.status)"
  }
  Write-Host "PAS V0 smoke: candidate QA summary answered=$($candidateQaSummary.answered) no_hit=$($candidateQaSummary.no_hit) error=$($candidateQaSummary.error)"
}

Write-Host "PAS V0 smoke passed"
