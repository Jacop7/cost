param(
  [string]$PrototypeDirectory = $PSScriptRoot,
  [switch]$Finalize
)

$ErrorActionPreference = 'Stop'
$contextName = 'full-page-flow-prototype-design-context.md'
$stateName = 'full-page-flow-prototype-design-sync-state.json'
$contextPath = Join-Path $PrototypeDirectory $contextName
$statePath = Join-Path $PrototypeDirectory $stateName
$failures = [System.Collections.Generic.List[string]]::new()

function Read-Utf8([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }
  return Get-Content -LiteralPath $Path -Raw -Encoding UTF8
}

function Add-Failure([string]$Message) {
  $script:failures.Add($Message)
}

function Match-One([string]$Contents, [string]$Pattern, [string]$Label) {
  $matches = [regex]::Matches($Contents, $Pattern)
  if ($matches.Count -ne 1) {
    Add-Failure "$Label : 정확히 1개여야 하나 $($matches.Count)개"
    return $null
  }
  return $matches[0]
}

function Get-Sha256([string]$Contents) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($Contents)
    return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  }
  finally {
    $sha.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $contextPath)) {
  Write-Error 'FAIL: 디자인 맥락 장부가 없습니다.'
}

$context = Read-Utf8 $contextPath
$idMatch = Match-One $context '(?m)^> 현재 동기화 ID:\s*`(?<value>DS-\d{8}-\d{3})`\s*$' '맥락 장부 현재 동기화 ID'
$statusMatch = Match-One $context '(?m)^> 문서 동기화 상태:\s*`(?<value>IN_PROGRESS|SYNCED)`\s*$' '맥락 장부 문서 동기화 상태'
$overallMatch = Match-One $context '(?m)^> 전체 UI 작업 상태:\s*`(?<value>IN_PROGRESS|COMPLETE)`\s*$' '맥락 장부 전체 UI 작업 상태'
$commonMatch = Match-One $context '(?m)^> 공통 변경:\s*`(?<value>예|아니오)`\s*$' '맥락 장부 공통 변경'
$uiMatch = Match-One $context '(?m)^> UI 변경:\s*`(?<value>예|아니오)`\s*$' '맥락 장부 UI 변경'
$prtMatch = Match-One $context '(?m)^> 변경 기록:\s*`(?<value>PRT-\d+)`\s*$' '맥락 장부 변경 기록'

if ($failures.Count -gt 0) {
  Write-Output 'DESIGN DOC SYNC: FAIL (맥락 장부 형식)'
  $failures | ForEach-Object { Write-Output "- $_" }
  exit 1
}

$syncId = $idMatch.Groups['value'].Value
$syncStatus = $statusMatch.Groups['value'].Value
$overallStatus = $overallMatch.Groups['value'].Value
$commonChange = $commonMatch.Groups['value'].Value
$uiChange = $uiMatch.Groups['value'].Value
$prtId = $prtMatch.Groups['value'].Value
$idDate = [datetime]::ParseExact($syncId.Substring(3, 8), 'yyyyMMdd', [Globalization.CultureInfo]::InvariantCulture).ToString('yyyy-MM-dd')

if ($syncStatus -ne 'SYNCED') {
  Add-Failure "$contextName : 문서 동기화 상태가 SYNCED가 아님 ($syncStatus)"
}
if ($overallStatus -eq 'COMPLETE' -and $context -notmatch '(?m)^- 전체 화면 전수 검수:\s*PASS\s*$') {
  Add-Failure "$contextName : 전체 UI 완료 근거가 없음"
}
if ($context -notmatch ('(?m)^###\s+' + [regex]::Escape($syncId) + '\s+·\s+.+$')) {
  Add-Failure "$contextName : 가장 최근 작업 제목에 현재 ID가 없음"
}
if ($context -notmatch '(?m)^- 다음 시작점:\s*.+$') {
  Add-Failure "$contextName : 다음 시작점 누락"
}

$required = [ordered]@{
  '0_full-page-flow-prototype-ui-applied.html' = 'html'
  'full-page-flow-prototype-current-spec.md' = 'spec'
  'full-page-flow-prototype-changelog.md' = 'changelog'
  '0_full-page-flow-prototype-ui-applied-review.md' = 'review'
  $contextName = 'context'
}
if ($commonChange -eq '예') {
  $required['full-page-flow-prototype-ui-guide.md'] = 'guide'
  $required['full-page-flow-prototype-design-work-plan.md'] = 'plan'
}

$contentsByFile = [ordered]@{}
foreach ($fileName in $required.Keys) {
  $filePath = Join-Path $PrototypeDirectory $fileName
  $contents = Read-Utf8 $filePath
  if ($null -eq $contents) {
    Add-Failure "$fileName : 파일 없음"
    continue
  }
  $contentsByFile[$fileName] = $contents
}

if ($contentsByFile.Contains('0_full-page-flow-prototype-ui-applied.html')) {
  $html = $contentsByFile['0_full-page-flow-prototype-ui-applied.html']
  $marker = Match-One $html ('(?m)^<!-- DESIGN_SYNC:\s*' + [regex]::Escape($syncId) + '\s*-->\s*$') 'UI 적용본 상단 marker'
  if ($null -ne $marker) {
    $lineNumber = ($html.Substring(0, $marker.Index) -split "`n").Count
    if ($lineNumber -gt 5) { Add-Failure "UI 적용본 marker : 첫 5줄 밖에 있음 ($lineNumber 줄)" }
  }
}

if ($contentsByFile.Contains('full-page-flow-prototype-current-spec.md')) {
  $null = Match-One $contentsByFile['full-page-flow-prototype-current-spec.md'] ('(?m)^- 현재 디자인 동기화 ID:\s*`' + [regex]::Escape($syncId) + '`\s*$') '현재 확정안 header ID'
}

if ($contentsByFile.Contains('full-page-flow-prototype-changelog.md')) {
  $changelog = $contentsByFile['full-page-flow-prototype-changelog.md']
  $historyIndex = $changelog.IndexOf('## 변경 내역')
  if ($historyIndex -lt 0) {
    Add-Failure '변경 기록 : 변경 내역 절 없음'
  }
  else {
    $history = $changelog.Substring($historyIndex)
    $firstPrt = [regex]::Match($history, '(?m)^###\s+(?<prt>PRT-\d+)\s+·\s+(?<date>\d{4}-\d{2}-\d{2}).*$')
    if (-not $firstPrt.Success) {
      Add-Failure '변경 기록 : 최신 PRT 제목을 찾지 못함'
    }
    else {
      if ($firstPrt.Groups['prt'].Value -ne $prtId) { Add-Failure "변경 기록 : 최신 PRT가 $prtId 아님 ($($firstPrt.Groups['prt'].Value))" }
      if ($firstPrt.Groups['date'].Value -ne $idDate) { Add-Failure '변경 기록 : 최신 PRT 날짜와 동기화 ID 날짜 불일치' }
      $blockStart = $firstPrt.Index
      $nextPrt = [regex]::Match($history.Substring($blockStart + $firstPrt.Length), '(?m)^###\s+PRT-\d+\s+·')
      $blockLength = if ($nextPrt.Success) { $firstPrt.Length + $nextPrt.Index } else { $history.Length - $blockStart }
      $latestBlock = $history.Substring($blockStart, $blockLength)
      if ($latestBlock -notmatch ('(?m)^- 디자인 동기화 ID:\s*`' + [regex]::Escape($syncId) + '`\s*$')) {
        Add-Failure "변경 기록 : 최신 $prtId 블록에 $syncId 없음"
      }
    }
  }
}

if ($contentsByFile.Contains('0_full-page-flow-prototype-ui-applied-review.md')) {
  $review = $contentsByFile['0_full-page-flow-prototype-ui-applied-review.md']
  $reviewHeading = [regex]::Match($review, ('(?m)^##\s+' + [regex]::Escape($syncId) + '\s+·\s+.+$'))
  if (-not $reviewHeading.Success) {
    Add-Failure '검수 기록 : 현재 ID 절 없음'
  }
  else {
    $afterHeading = $review.Substring($reviewHeading.Index + $reviewHeading.Length)
    $nextHeading = [regex]::Match($afterHeading, '(?m)^##\s+')
    $reviewBlock = if ($nextHeading.Success) { $afterHeading.Substring(0, $nextHeading.Index) } else { $afterHeading }
    foreach ($field in @('대상', '기대값', '실제값', 'PC 검수', '모바일 검수', '미검수', '결과', '증거')) {
      if ($reviewBlock -notmatch ('(?m)^- ' + [regex]::Escape($field) + ':\s*\S.+$')) {
        Add-Failure "검수 기록 : $field 필드 누락"
      }
    }
    if ($reviewBlock -notmatch '(?ms)^- PC 검수:.*?\bPASS\b\s*(?=^- |\z)') { Add-Failure '검수 기록 : PC PASS 누락' }
    if ($reviewBlock -notmatch '(?ms)^- 모바일 검수:.*?\bPASS\b\s*(?=^- |\z)') { Add-Failure '검수 기록 : 모바일 PASS 누락' }
    if ($reviewBlock -notmatch '(?m)^- 미검수:\s*없음\s*$') { Add-Failure '검수 기록 : 미검수 항목이 남아 있음' }
    if ($reviewBlock -notmatch '(?m)^- 결과:\s*PASS\s*$') { Add-Failure '검수 기록 : 최종 PASS 누락' }
  }
}

if ($commonChange -eq '예') {
  if ($contentsByFile.Contains('full-page-flow-prototype-ui-guide.md')) {
    $null = Match-One $contentsByFile['full-page-flow-prototype-ui-guide.md'] ('(?m)^- 현재 디자인 동기화 ID:\s*`' + [regex]::Escape($syncId) + '`\s*$') 'UI 가이드 header ID'
  }
  if ($contentsByFile.Contains('full-page-flow-prototype-design-work-plan.md')) {
    $null = Match-One $contentsByFile['full-page-flow-prototype-design-work-plan.md'] ('(?m)^> 현재 디자인 동기화 ID:\s*`' + [regex]::Escape($syncId) + '`\s*$') '디자인 실행서 header ID'
  }
}

# --- 렌더 감사 증거 결속 (PRT-188) ---
# 문서에 적는 렌더 산출물 분포와 뷰포트 회귀 수치는 render-audit 스크립트의 출력에서만 인용한다.
# 이 검사는 DOM 을 다시 재지 않는다(그것은 node+playwright 가 필요하다).
# 보존된 결과 JSON 이 "지금 이 적용본, 지금 이 동기화 ID" 에 묶여 있는지를 확인한다.
# 적용본이 바뀌면 증거가 자동으로 무효가 되므로, 낡은 측정값을 그대로 인용할 수 없다.
$auditName = 'full-page-flow-prototype-render-audit.json'
$auditScriptName = 'full-page-flow-prototype-render-audit.mjs'
$auditPath = Join-Path $PrototypeDirectory $auditName
$auditScriptPath = Join-Path $PrototypeDirectory $auditScriptName
if (-not (Test-Path -LiteralPath $auditPath)) {
  Add-Failure "$auditName : 렌더 감사 결과가 없음"
}
elseif (-not (Test-Path -LiteralPath $auditScriptPath)) {
  Add-Failure "$auditScriptName : 렌더 감사 스크립트가 없음"
}
else {
  $audit = Read-Utf8 $auditPath | ConvertFrom-Json
  $appliedBytes = [System.IO.File]::ReadAllBytes((Join-Path $PrototypeDirectory '0_full-page-flow-prototype-ui-applied.html'))
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { $appliedSha = ([System.BitConverter]::ToString($sha.ComputeHash($appliedBytes))).Replace('-', '').ToLowerInvariant() }
  finally { $sha.Dispose() }
  $scriptBytes = [System.IO.File]::ReadAllBytes($auditScriptPath)
  $sha2 = [System.Security.Cryptography.SHA256]::Create()
  try { $auditScriptSha = ([System.BitConverter]::ToString($sha2.ComputeHash($scriptBytes))).Replace('-', '').ToLowerInvariant() }
  finally { $sha2.Dispose() }
  if ($audit.manifest.target.sha256 -ne $appliedSha) {
    Add-Failure "$auditName : 적용본 SHA 불일치. 감사=$($audit.manifest.target.sha256) 현재=$appliedSha. 재측정 필요"
  }
  if ($audit.manifest.target.designSyncId -ne $syncId) {
    Add-Failure "$auditName : 동기화 ID 불일치. 감사=$($audit.manifest.target.designSyncId) 현재=$syncId"
  }
  if ($audit.manifest.script.sha256 -ne $auditScriptSha) {
    Add-Failure "$auditName : 측정 스크립트 SHA 불일치. 감사=$($audit.manifest.script.sha256) 현재=$auditScriptSha"
  }
  # 결과 자체가 계약을 만족하는지 단언한다 (PRT-189).
  # 결속만 맞고 내용이 실패인 JSON 도 -Finalize 되던 구멍을 막는다.
  $s = $audit.summary
  if ($s.targetsMeasured -lt 1) { Add-Failure "$auditName : 측정 target 이 없음" }
  if ($s.duplicateTargets -ne 0) { Add-Failure "$auditName : target 중복 $($s.duplicateTargets)건" }
  if ($s.activeTargets + $s.hiddenTargets -ne $s.targetsMeasured) {
    Add-Failure "$auditName : 산식 불일치 활성 $($s.activeTargets) + 숨김 $($s.hiddenTargets) != 측정 $($s.targetsMeasured)"
  }
  if ($s.activeScreens + $s.activePopupPairs -ne $s.activeTargets) {
    Add-Failure "$auditName : 산식 불일치 screen $($s.activeScreens) + popup쌍 $($s.activePopupPairs) != 활성 $($s.activeTargets)"
  }
  if ($s.activeUniquePopupIds -lt 1 -or $s.activeUniquePopupIds -gt $s.activePopupPairs) {
    Add-Failure "$auditName : 고유 popup ID 수가 비정상 ($($s.activeUniquePopupIds))"
  }
  if ($s.noRendererIds.Count -gt 0) { Add-Failure "$auditName : 렌더러 없는 활성 ID $($s.noRendererIds.Count)건 — 조사 필요" }
  if ($s.sheetBodyUnder3.Count -gt 0) { Add-Failure "$auditName : 시트 본문 3요소 미만 $($s.sheetBodyUnder3.Count)건" }
  if ($s.offScaleOutsideShellAllowlist.Count -gt 0) {
    Add-Failure "$auditName : 허용 목록 밖 스케일 위반 — $($s.offScaleOutsideShellAllowlist -join ', ')"
  }
  $requiredPasses = @('pc', 'mobile320', 'mobile320z2', 'mobile320t2')
  foreach ($passId in $requiredPasses) {
    if ($null -eq $s.passes.$passId) { Add-Failure "$auditName : 검수 패스 $passId 누락" }
  }

  # 0 이어야 하는 지표의 위반을 알려진 미해결 목록과 양방향 대조한다.
  # 목록에 없는 위반 → 새 회귀이므로 FAIL. 목록에 있는데 재현 안 됨 → 낡은 예외이므로 FAIL.
  # 그래서 이 목록은 '무시 목록'이 아니라 '고쳐야 할 것의 정확한 잔여 목록'이다.
  $knownName = 'full-page-flow-prototype-render-audit-known.json'
  $knownPath = Join-Path $PrototypeDirectory $knownName
  if (-not (Test-Path -LiteralPath $knownPath)) {
    Add-Failure "$knownName : 알려진 미해결 목록이 없음"
  }
  else {
    $known = Read-Utf8 $knownPath | ConvertFrom-Json
    $allowed = @{}
    foreach ($d in $known.knownDefects) {
      foreach ($t in $d.targets) { $allowed["$($d.pass)|$($d.metric)|$t"] = $d.id }
    }
    $observed = @{}
    foreach ($passId in $s.violations.PSObject.Properties.Name) {
      foreach ($metric in $s.violations.$passId.PSObject.Properties.Name) {
        foreach ($t in $s.violations.$passId.$metric) { $observed["$passId|$metric|$t"] = $true }
      }
    }
    foreach ($k in $observed.Keys) {
      if (-not $allowed.ContainsKey($k)) { Add-Failure "$auditName : 알려지지 않은 위반 — $k" }
    }
    foreach ($k in $allowed.Keys) {
      if (-not $observed.ContainsKey($k)) { Add-Failure "$knownName : 재현되지 않는 예외 $($allowed[$k]) — $k. 해결됐다면 목록에서 지운다" }
    }
  }
}

# --- 디자인 감사 증거 결속 (PRT-191) ---
# 토큰 기획서가 인용하는 타이포·색·간격·반경·그림자·컨트롤·터치·아이콘 수치는
# design-audit 스크립트의 출력에서만 인용한다. render-audit 과 같은 방식으로
# "지금 이 적용본, 지금 이 동기화 ID, 지금 이 스크립트" 에 묶여 있는지 확인한다.
$designAuditName = 'full-page-flow-prototype-design-audit.json'
$designAuditScriptName = 'full-page-flow-prototype-design-audit.mjs'
$designAuditPath = Join-Path $PrototypeDirectory $designAuditName
$designAuditScriptPath = Join-Path $PrototypeDirectory $designAuditScriptName
if (-not (Test-Path -LiteralPath $designAuditPath)) {
  Add-Failure "$designAuditName : 디자인 감사 결과가 없음"
}
elseif (-not (Test-Path -LiteralPath $designAuditScriptPath)) {
  Add-Failure "$designAuditScriptName : 디자인 감사 스크립트가 없음"
}
else {
  $dAudit = Read-Utf8 $designAuditPath | ConvertFrom-Json
  $dAppliedBytes = [System.IO.File]::ReadAllBytes((Join-Path $PrototypeDirectory '0_full-page-flow-prototype-ui-applied.html'))
  $dSha = [System.Security.Cryptography.SHA256]::Create()
  try { $dAppliedSha = ([System.BitConverter]::ToString($dSha.ComputeHash($dAppliedBytes))).Replace('-', '').ToLowerInvariant() }
  finally { $dSha.Dispose() }
  $dScriptBytes = [System.IO.File]::ReadAllBytes($designAuditScriptPath)
  $dSha2 = [System.Security.Cryptography.SHA256]::Create()
  try { $dScriptSha = ([System.BitConverter]::ToString($dSha2.ComputeHash($dScriptBytes))).Replace('-', '').ToLowerInvariant() }
  finally { $dSha2.Dispose() }
  if ($dAudit.manifest.target.sha256 -ne $dAppliedSha) {
    Add-Failure "$designAuditName : 적용본 SHA 불일치. 감사=$($dAudit.manifest.target.sha256) 현재=$dAppliedSha. 재측정 필요"
  }
  if ($dAudit.manifest.target.designSyncId -ne $syncId) {
    Add-Failure "$designAuditName : 동기화 ID 불일치. 감사=$($dAudit.manifest.target.designSyncId) 현재=$syncId"
  }
  if ($dAudit.manifest.script.sha256 -ne $dScriptSha) {
    Add-Failure "$designAuditName : 측정 스크립트 SHA 불일치. 감사=$($dAudit.manifest.script.sha256) 현재=$dScriptSha"
  }
  # 측정 규칙이 결과에 같이 적혀 있어야 한다. 규칙 없는 숫자는 재현할 수 없다.
  foreach ($ruleKey in @('대상', '아이콘', '슬롯', '카드', '간격', 'margin auto')) {
    if ($null -eq $dAudit.manifest.rules.$ruleKey) {
      Add-Failure "$designAuditName : 측정 규칙 '$ruleKey' 누락"
    }
  }
  if ($dAudit.manifest.targetsMeasured -lt 1) { Add-Failure "$designAuditName : 측정 target 이 없음" }
  # 두 감사를 서로 대조한다. 디자인 감사는 활성 target 만 재므로 렌더 감사의 activeTargets 와
  # 같아야 한다. 한쪽만 고쳐 쓰면 여기서 어긋난다.
  if ($null -ne $audit -and $null -ne $audit.summary.activeTargets) {
    if ($dAudit.manifest.targetsMeasured -ne $audit.summary.activeTargets) {
      Add-Failure "$designAuditName : 측정 target $($dAudit.manifest.targetsMeasured) 이 렌더 감사의 활성 target $($audit.summary.activeTargets) 과 불일치"
    }
    if ($dAudit.manifest.target.sha256 -ne $audit.manifest.target.sha256) {
      Add-Failure "$designAuditName : 두 감사의 적용본 SHA 가 서로 다름"
    }
  }
  if ($null -eq $dAudit.manifest.marginAutoExcluded) {
    Add-Failure "$designAuditName : margin auto 제외 개수가 기록되지 않음"
  }
  # 축별 산식 단언 — 종류가 0 인 축이 있으면 측정이 무너진 것이다.
  foreach ($axis in @('typo', 'color', 'space', 'radius', 'shadow', 'control', 'touch', 'icon')) {
    $bucket = $dAudit.summary.$axis
    if ($null -eq $bucket) { Add-Failure "$designAuditName : 축 $axis 누락"; continue }
    if ($bucket.'종류' -lt 1) { Add-Failure "$designAuditName : 축 $axis 의 종류가 0" }
    if ($bucket.'합계' -lt $bucket.'종류') {
      Add-Failure "$designAuditName : 축 $axis 산식 불일치 합계 $($bucket.'합계') < 종류 $($bucket.'종류')"
    }
    $listed = ($dAudit.$axis | Measure-Object).Count
    if ($listed -ne $bucket.'종류') {
      Add-Failure "$designAuditName : 축 $axis 의 목록 $listed 건과 요약 종류 $($bucket.'종류') 불일치"
    }
    $sum = 0
    foreach ($row in $dAudit.$axis) { $sum += $row.n }
    if ($sum -ne $bucket.'합계') {
      Add-Failure "$designAuditName : 축 $axis 의 항목 합 $sum 과 요약 합계 $($bucket.'합계') 불일치"
    }
  }
}

if ($failures.Count -gt 0) {
  Write-Output "DESIGN DOC SYNC: FAIL ($syncId)"
  $failures | ForEach-Object { Write-Output "- $_" }
  exit 1
}

$hashes = [ordered]@{}
foreach ($fileName in $contentsByFile.Keys) {
  $hashes[$fileName] = Get-Sha256 $contentsByFile[$fileName]
}
foreach ($fileName in @($auditName, $auditScriptName, 'full-page-flow-prototype-render-audit-known.json', $designAuditName, $designAuditScriptName)) {
  $contents = Read-Utf8 (Join-Path $PrototypeDirectory $fileName)
  if ($null -ne $contents) { $hashes[$fileName] = Get-Sha256 $contents }
}

$previousState = if (Test-Path -LiteralPath $statePath) { Read-Utf8 $statePath | ConvertFrom-Json } else { $null }
if ($null -ne $previousState -and $previousState.lastCompletedId -eq $syncId) {
  foreach ($fileName in $hashes.Keys) {
    $previousHash = $previousState.hashes.$fileName
    if ($null -eq $previousHash -or $previousHash -ne $hashes[$fileName]) {
      Add-Failure "$fileName : 완료된 $syncId 이후 변경됨. 새 동기화 ID 필요"
    }
  }
  if ($failures.Count -gt 0) {
    Write-Output "DESIGN DOC SYNC: FAIL ($syncId)"
    $failures | ForEach-Object { Write-Output "- $_" }
    exit 1
  }
}
elseif (-not $Finalize) {
  Write-Output "DESIGN DOC SYNC: FAIL ($syncId)"
  Write-Output '- 새 동기화 ID는 -Finalize로 완료 장부에 등록해야 합니다.'
  exit 1
}
else {
  if ($null -ne $previousState -and $syncId -le $previousState.lastCompletedId) {
    Write-Output "DESIGN DOC SYNC: FAIL ($syncId)"
    Write-Output "- 이전 완료 ID $($previousState.lastCompletedId)보다 큰 새 ID가 필요합니다."
    exit 1
  }
  $state = [ordered]@{
    lastCompletedId = $syncId
    completedAt = [datetimeoffset]::Now.ToString('o')
    overallUiStatus = $overallStatus
    commonChange = $commonChange
    uiChange = $uiChange
    prt = $prtId
    hashes = $hashes
  }
  $stateJson = $state | ConvertTo-Json -Depth 5
  [System.IO.File]::WriteAllText($statePath, $stateJson + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

Write-Output "DESIGN DOC SYNC: PASS ($syncId)"
Write-Output "문서 동기화: $syncStatus / 전체 UI 작업: $overallStatus"
Write-Output "공통 변경: $commonChange / UI 변경: $uiChange / 변경 기록: $prtId"
$required.Keys | ForEach-Object { Write-Output "- PASS: $_" }
if ($Finalize) { Write-Output "- FINALIZED: $stateName" }
exit 0
