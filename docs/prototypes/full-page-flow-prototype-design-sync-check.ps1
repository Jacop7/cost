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
  foreach ($ruleKey in @('대상', '아이콘', '슬롯', '카드', '간격', 'margin auto', '출처', '타이포', '컨트롤')) {
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

# --- 글로벌 스트레스 증거 결속 (PRT-192) ---
# 한국어는 같은 뜻을 가장 짧게 쓰는 언어에 가깝다. 한국어 320px 에서 딱 맞는 레이아웃은
# 번역하면 거의 항상 깨진다. UI 가이드 `C-20` 의 "30~50% 긴 번역" 검수를 이 증거가 담는다.
$i18nName = 'full-page-flow-prototype-i18n-stress.json'
$i18nScriptName = 'full-page-flow-prototype-i18n-stress.mjs'
$i18nPath = Join-Path $PrototypeDirectory $i18nName
$i18nScriptPath = Join-Path $PrototypeDirectory $i18nScriptName
if (-not (Test-Path -LiteralPath $i18nPath)) {
  Add-Failure "$i18nName : 글로벌 스트레스 결과가 없음"
}
elseif (-not (Test-Path -LiteralPath $i18nScriptPath)) {
  Add-Failure "$i18nScriptName : 글로벌 스트레스 스크립트가 없음"
}
else {
  $iAudit = Read-Utf8 $i18nPath | ConvertFrom-Json
  $iBytes = [System.IO.File]::ReadAllBytes((Join-Path $PrototypeDirectory '0_full-page-flow-prototype-ui-applied.html'))
  $iSha = [System.Security.Cryptography.SHA256]::Create()
  try { $iAppliedSha = ([System.BitConverter]::ToString($iSha.ComputeHash($iBytes))).Replace('-', '').ToLowerInvariant() }
  finally { $iSha.Dispose() }
  $iScriptBytes = [System.IO.File]::ReadAllBytes($i18nScriptPath)
  $iSha2 = [System.Security.Cryptography.SHA256]::Create()
  try { $iScriptSha = ([System.BitConverter]::ToString($iSha2.ComputeHash($iScriptBytes))).Replace('-', '').ToLowerInvariant() }
  finally { $iSha2.Dispose() }
  if ($iAudit.manifest.target.sha256 -ne $iAppliedSha) {
    Add-Failure "$i18nName : 적용본 SHA 불일치. 감사=$($iAudit.manifest.target.sha256) 현재=$iAppliedSha. 재측정 필요"
  }
  if ($iAudit.manifest.target.designSyncId -ne $syncId) {
    Add-Failure "$i18nName : 동기화 ID 불일치. 감사=$($iAudit.manifest.target.designSyncId) 현재=$syncId"
  }
  if ($iAudit.manifest.script.sha256 -ne $iScriptSha) {
    Add-Failure "$i18nName : 측정 스크립트 SHA 불일치. 감사=$($iAudit.manifest.script.sha256) 현재=$iScriptSha"
  }
  foreach ($ruleKey in @('번역문', '단위', '숫자', '아이콘', '셸', '기준선', '가로 스크롤', '붙음', '집계 단위', '정확도', '오차 방향', '재현하지 않는 것')) {
    if ($null -eq $iAudit.manifest.rules.$ruleKey) { Add-Failure "$i18nName : 측정 규칙 '$ruleKey' 누락" }
  }
  # 확대 정확도를 보고하지 않으면 "잘림 0" 이 무엇을 뜻하는지 알 수 없다.
  # 특히 덜 늘어난 요소의 잘림 0 은 보수적이 아니라 낙관적이므로 atRisk 를 반드시 남긴다.
  foreach ($passId in @('w130', 'w150', 'w130t2')) {
    $st = $iAudit.summary.stretch.$passId
    if ($null -eq $st) { Add-Failure "$i18nName : $passId 확대 통계 누락"; continue }
    if ($null -eq $st.errorHistogram) { Add-Failure "$i18nName : $passId 오차 분포(errorHistogram) 누락" }
    if ($null -eq $st.atRiskCount)    { Add-Failure "$i18nName : $passId atRisk 개수 누락 — 덜 늘어난 요소가 제대로 늘렸을 때 넘쳤을지 판정하지 않았다" }
    if ($null -eq $st.underStretched) { Add-Failure "$i18nName : $passId underStretched 누락" }
  }
  if ($null -ne $audit -and $null -ne $audit.summary.activeTargets) {
    if ($iAudit.manifest.targetsMeasured -ne $audit.summary.activeTargets) {
      Add-Failure "$i18nName : 측정 target $($iAudit.manifest.targetsMeasured) 이 렌더 감사의 활성 target $($audit.summary.activeTargets) 과 불일치"
    }
  }
  # 패스 4종이 다 있어야 한다. 기준선이 없으면 "번역 때문에 깨졌다"를 말할 수 없다.
  foreach ($passId in @('base', 'w130', 'w150', 'w130t2')) {
    if ($null -eq $iAudit.summary.passes.$passId) { Add-Failure "$i18nName : 검수 패스 $passId 누락" }
  }
  # 기준선(한국어 320px)은 깨끗해야 한다. 여기가 깨져 있으면 그건 번역 문제가 아니라
  # 이미 있는 제품 결함이고, render-audit 이 먼저 잡았어야 한다.
  $b = $iAudit.summary.passes.base
  if ($null -ne $b) {
    if ($b.targetsWithClipped -ne 0) { Add-Failure "$i18nName : 기준선에서 잘림 $($b.targetsWithClipped)건 — 번역 이전의 결함" }
    if ($b.targetsWithEscapee -ne 0) { Add-Failure "$i18nName : 기준선에서 화면 이탈 $($b.targetsWithEscapee)건 — 번역 이전의 결함" }
    if ($b.targetsWithPhoneOverflow -ne 0) { Add-Failure "$i18nName : 기준선에서 가로 넘침 $($b.targetsWithPhoneOverflow)건 — 번역 이전의 결함" }
  }
  # 확대가 실제로 일어났는지 단언한다. 0건이면 스트레스를 안 준 채로 통과할 수 있다.
  if ($iAudit.summary.stretch.w130.stretched -lt 1) { Add-Failure "$i18nName : w130 에서 늘어난 텍스트가 없음 — 스트레스가 걸리지 않았다" }
  if ($iAudit.summary.stretch.w130t2.text2x -lt 1) { Add-Failure "$i18nName : w130t2 에서 글자 확대가 적용되지 않았다" }
  if ($iAudit.summary.stretch.w130.skippedNumeric -lt 1) { Add-Failure "$i18nName : 숫자 제외가 0건 — 숫자까지 늘렸을 가능성" }
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
foreach ($fileName in @($auditName, $auditScriptName, 'full-page-flow-prototype-render-audit-known.json', $designAuditName, $designAuditScriptName, $i18nName, $i18nScriptName,
    'full-page-flow-prototype-token-map.json', 'full-page-flow-prototype-token-map-check.mjs',
    'full-page-flow-prototype-token-map-check.json')) {
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
