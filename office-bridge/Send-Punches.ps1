# Sends face/fingerprint punches from the office eSSL eTimeTrackLite database
# to the Parva portal. Runs on the office PC that hosts eTimeTrackLite.
#
#   Send-Punches.ps1             normal run (re-sends the last 3 days; the
#                                website ignores punches it already has)
#   Send-Punches.ps1 -SinceDays 40   one-time catch-up of older punches
#   Send-Punches.ps1 -Discover       only LOOK at the database (sends nothing)
#
# Nothing here changes the eTimeTrack database -- it only reads it.
param([switch]$Discover, [int]$SinceDays = 3)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$logFile = Join-Path $PSScriptRoot 'sync.log'
function Log($msg) {
  $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Write-Host $line
  Add-Content -Path $logFile -Value $line
}

try {
  $cfg = Get-Content (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
  $connStr = "Server=$($cfg.sqlServer);Database=$($cfg.database);User ID=$($cfg.sqlUser);Password=$($cfg.sqlPassword);Encrypt=False;TrustServerCertificate=True;Connection Timeout=15;"
  $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
  $conn.Open()

  function Query($sql, $params = @{}) {
    $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql
    foreach ($k in $params.Keys) { [void]$cmd.Parameters.AddWithValue($k, $params[$k]) }
    $dt = New-Object System.Data.DataTable
    (New-Object System.Data.SqlClient.SqlDataAdapter($cmd)).Fill($dt) | Out-Null
    return ,$dt
  }

  $tables = Query "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_NAME LIKE 'DeviceLogs[_]%' ORDER BY TABLE_NAME"
  if ($Discover) {
    Write-Host "`n=== Tables found ==="
    $tables.Rows | ForEach-Object { Write-Host $_.TABLE_NAME }
    $latest = $tables.Rows | Where-Object { $_.TABLE_NAME -match '^DeviceLogs_(\d{1,2})_(\d{4})$' } |
      Sort-Object { [int]$Matches[2] * 100 + [int]$Matches[1] } | Select-Object -Last 1
    if ($latest) {
      $t = $latest.TABLE_NAME
      Write-Host "`n=== Columns of $t ==="
      (Query "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='$t'").Rows |
        ForEach-Object { Write-Host ("{0} ({1})" -f $_.COLUMN_NAME, $_.DATA_TYPE) }
      Write-Host "`n=== Last 5 punches in $t ==="
      (Query "SELECT TOP 5 * FROM [$t] ORDER BY 1 DESC") | Format-Table -AutoSize | Out-String | Write-Host
    }
    Write-Host "`n=== Employees table columns ==="
    (Query "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Employees'").Rows |
      ForEach-Object { Write-Host $_.COLUMN_NAME }
    $conn.Close()
    return
  }

  $since = (Get-Date).Date.AddDays(-$SinceDays)
  $now = Get-Date
  $wanted = @()
  $d = Get-Date -Year $since.Year -Month $since.Month -Day 1
  while ($d -le $now) { $wanted += ("DeviceLogs_{0}_{1}" -f $d.Month, $d.Year); $d = $d.AddMonths(1) }
  $existing = $tables.Rows | ForEach-Object { $_.TABLE_NAME }

  $punches = New-Object System.Collections.Generic.List[object]
  foreach ($name in $wanted) {
    if ($existing -notcontains $name) { continue }
    $rows = Query "SELECT UserId, LogDate FROM [$name] WHERE LogDate >= @since" @{ '@since' = $since }
    foreach ($r in $rows.Rows) {
      $punches.Add(@{ code = [string]$r.UserId; at = ([datetime]$r.LogDate).ToString('yyyy-MM-dd HH:mm:ss') })
    }
  }
  $conn.Close()

  if ($punches.Count -eq 0) { Log "No punches in the last $SinceDays day(s)."; return }

  $headers = @{ 'x-sync-key' = $cfg.syncKey }
  $sent = 0; $updated = 0; $unmapped = @{}
  for ($i = 0; $i -lt $punches.Count; $i += 500) {
    $chunk = $punches.GetRange($i, [Math]::Min(500, $punches.Count - $i))
    $body = @{ punches = $chunk } | ConvertTo-Json -Depth 4 -Compress
    $resp = Invoke-RestMethod -Method Post -Uri $cfg.apiUrl -Headers $headers -ContentType 'application/json' -Body $body
    $sent += $resp.received; $updated += $resp.recordsUpdated
    foreach ($u in $resp.unmapped) { $unmapped[$u] = $true }
  }
  $msg = "Sent $sent punch(es); $updated attendance record(s) updated."
  if ($unmapped.Count -gt 0) { $msg += "  Not matched to any employee yet (Biometric ID): " + (($unmapped.Keys | Sort-Object) -join ', ') }
  Log $msg
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  exit 1
}
