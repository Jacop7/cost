$ErrorActionPreference = 'Stop'

$runner = Join-Path $PSScriptRoot 'fable-review.mjs'
& node $runner @args
exit $LASTEXITCODE
