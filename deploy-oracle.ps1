[CmdletBinding()]
param(
    [string]$Server = 'ubuntu@88.96.60.173',
    [string]$IdentityFile = "$PSScriptRoot\..\autres\dorify_key",
    [string]$RemoteDirectory = '/home/ubuntu/dorify',
    [string]$Version = (Get-Date -Format 'yyyyMMdd-HHmmss'),
    [string]$EnvFile = "$PSScriptRoot\.env.oracle.local",
    [switch]$Migrate,
    [switch]$Seed,
    [switch]$ResetDatabase,
    [switch]$DeployProxy,
    [switch]$BuildOnly
)
$ErrorActionPreference = 'Stop'
# Each repository contains its own copy: no dependency on sibling repositories.
$component = 'api'
function Invoke-Native([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE" }
}
if ($Server -notmatch '^[a-zA-Z0-9_.@-]+$' -or $RemoteDirectory -notmatch '^/[a-zA-Z0-9_./-]+$' -or $RemoteDirectory.Contains('..')) { throw 'Invalid remote destination' }
if ($Version -notmatch '^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,100}$') { throw 'Invalid image version' }
if ($component -ne 'api' -and ($Migrate -or $Seed -or $ResetDatabase -or $DeployProxy)) { throw 'Database and proxy switches are API-only' }
if ($ResetDatabase -and -not $BuildOnly) {
    if ((Read-Host 'This deletes dorify and dorify_agent schemas. Type RESET dorify to confirm') -cne 'RESET dorify') { throw 'Reset cancelled' }
}
$service = @{api='engine';web='app';site='site'}[$component]
$variable = @{api='API_IMAGE';web='WEB_IMAGE';site='SITE_IMAGE'}[$component]
$compose = "compose.$component.oracle.yaml"
$image = "dorify/${service}:oracle-$Version"
$maintenance = "dorify/dbtools:oracle-$Version"
$dbCommand = if ($ResetDatabase) { 'db:reset' } elseif ($Seed) { 'db:init:seed' } elseif ($Migrate) { 'db:init' } else { '' }
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('dorify-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporary | Out-Null
try {
    $buildArgs = @('build','--platform','linux/amd64','--target','runtime','-t',$image)
    if ($component -eq 'web') {
        # Demo mode is explicit; production mode requires real legal information.
        $buildArgs += @('--build-arg','VITE_APP_ENV=development','--build-arg','VITE_DORIFY_DEPLOYMENT_MODE=cloud','--build-arg','VITE_PUBLIC_TRACKING_URL=https://app.dorify.fr')
    }
    Invoke-Native docker ($buildArgs + @($PSScriptRoot))
    $images = @($image)
    if ($dbCommand) {
        Invoke-Native docker @('build','--platform','linux/amd64','--target','dbtools','-t',$maintenance,$PSScriptRoot)
        $images += $maintenance
    }
    if ($BuildOnly) { Write-Host "Built $($images -join ', ')"; return }
    if (-not (Test-Path -LiteralPath $IdentityFile)) { throw 'SSH identity file not found' }
    $sshArgs = @('-i',$IdentityFile,'-o','BatchMode=yes','-o','ConnectTimeout=15')
    # A dedicated Oracle file avoids uploading the development .env accidentally.
    if ($PSBoundParameters.ContainsKey('EnvFile') -and -not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) { throw 'Oracle environment file not found' }
    Invoke-Native ssh ($sshArgs + @($Server,'docker compose version >/dev/null && command -v python3 >/dev/null'))
    $archive = Join-Path $temporary 'images.tar'
    Invoke-Native docker (@('save','-o',$archive) + $images)
    $release = "$RemoteDirectory/releases/$component-$Version"
    Invoke-Native ssh ($sshArgs + @($Server,"umask 077; mkdir -p '$RemoteDirectory/releases' && mkdir '$release'"))
    if (Test-Path -LiteralPath $EnvFile -PathType Leaf) {
        $uploadEnv = Join-Path $temporary 'environment.upload'
        [IO.File]::WriteAllText($uploadEnv,([IO.File]::ReadAllText((Resolve-Path $EnvFile)).Replace("`r`n","`n")),(New-Object Text.UTF8Encoding($false)))
        Invoke-Native scp @('-i',$IdentityFile,'-o','BatchMode=yes',$uploadEnv,"${Server}:$release/environment.upload")
    }
    Invoke-Native scp (@('-i',$IdentityFile,'-o','BatchMode=yes',$archive,(Join-Path $PSScriptRoot $compose),"${Server}:$release/"))
    if ($DeployProxy) {
        Invoke-Native scp @('-i',$IdentityFile,'-o','BatchMode=yes',(Join-Path $PSScriptRoot 'Caddyfile'),(Join-Path $PSScriptRoot 'compose.proxy.oracle.yaml'),"${Server}:$release/")
    }
    $shell = @'
#!/bin/sh
set -eu
umask 077
cd '__ROOT__'
release='__RELEASE__'
# Prevent overlapping deliveries, including database maintenance.
exec 9>.oracle-deploy.lock
flock -n 9 || { echo 'Another delivery is running'; exit 1; }
if [ -f .env ]; then cp .env "$release/environment.before"; fi
# Merge on the VM without printing secrets or sourcing dotenv as shell code.
python3 - "$release" <<'PYTHON'
import os, pathlib, re, sys
from urllib.parse import quote
release = pathlib.Path(sys.argv[1])
target = pathlib.Path('.env')
def read(path):
    values = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        match = re.match(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$', line)
        if match:
            values[match[1]] = match[2].strip()
    return values
existing = read(target)
incoming = read(release / 'environment.upload')
# Existing nonempty values win, including secrets and other components' settings.
merged = dict(incoming)
merged.update({key: value for key, value in existing.items() if value not in ('', "''", '""')})
def value(key):
    raw = merged.get(key, '')
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
        raw = raw[1:-1]
    return raw
missing = [key for key in ('POSTGRES_PASSWORD', 'JWT_SECRET') if not value(key)]
if missing:
    raise SystemExit('Missing Oracle settings: ' + ', '.join(missing) + '. Fill .env.oracle.local using .env.oracle.example; existing database credentials must be reused.')
if not value('DATABASE_URL'):
    url = 'postgresql://dori:' + quote(value('POSTGRES_PASSWORD'), safe='') + '@postgres:5432/dori'
    merged['DATABASE_URL'] = "'" + url + "'"
merged['AUTO_RUN_MIGRATIONS'] = 'false'
# Preserve comments/unknown entries in the original; append only missing settings.
text = target.read_text(encoding='utf-8-sig') if target.exists() else ''
for key, raw in merged.items():
    if key not in existing or existing[key] in ('', "''", '""') or key == 'AUTO_RUN_MIGRATIONS':
        text = re.sub(r'(?m)^\s*(?:export\s+)?' + re.escape(key) + r'\s*=.*$', '', text)
        text += '\n' + key + '=' + raw + '\n'
candidate = release / 'environment.prepared'
candidate.write_text(text, encoding='utf-8')
candidate.chmod(0o600)
os.replace(candidate, target)
target.chmod(0o600)
upload = release / 'environment.upload'
if upload.exists():
    upload.unlink()
PYTHON
docker load -i "$release/images.tar"
if [ -f '__COMPOSE__' ]; then cp '__COMPOSE__' "$release/compose.before.yaml"; fi
cp "$release/__COMPOSE__" '__COMPOSE__'
export __VARIABLE__='__IMAGE__'
export AUTO_RUN_MIGRATIONS=false
dc() { docker compose --env-file .env -f '__COMPOSE__' "$@"; }
dc config --quiet
# Bootstrap named external volumes on a fresh VM; existing volumes are reused.
for volume in dorify-cloud-postgres-data dorify-cloud-redis-data dorify-site-requests dorify-proxy_caddy_data dorify-proxy_caddy_config; do
    docker volume create "$volume" >/dev/null
done
__DATABASE__
dc up -d --wait --wait-timeout 180
# Persist only this component's image reference after a healthy delivery.
grep -v '^__VARIABLE__=' .env > "$release/environment.next" || true
printf '\n__VARIABLE__=__IMAGE__\n' >> "$release/environment.next"
mv "$release/environment.next" .env
chmod 600 .env
__PROXY__
dc ps
echo "Delivery complete. Previous configuration: $release"
'@
    $database = @'
dc up -d --wait postgres redis
mkdir -p backups
backup="backups/dori-__VERSION__.dump"
docker exec cloud-dorify-postgres-1 pg_dump -U dori -d dori -Fc > "$backup"
test -s "$backup"
docker exec -i cloud-dorify-postgres-1 pg_restore --list < "$backup" >/dev/null
echo "Database backup: $backup"
dc stop engine
# Reuse engine environment without exposing secrets in command arguments.
dc run --rm --no-deps --entrypoint npm -e AUTO_RUN_MIGRATIONS=false -e DB_SKIP_CREATE=true engine --version >/dev/null
cat > "$release/maintenance.yaml" <<'YAML'
services:
  engine:
    image: __MAINTENANCE__
YAML
docker compose --env-file .env -f '__COMPOSE__' -f "$release/maintenance.yaml" run --rm --no-deps --entrypoint npm -e AUTO_RUN_MIGRATIONS=false -e DB_SKIP_CREATE=true engine run __DBCOMMAND__
'@
    $proxy = @'
docker run --rm -v "$release/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
if [ -f Caddyfile ]; then cp Caddyfile "$release/Caddyfile.before"; fi
if [ -f compose.proxy.oracle.yaml ]; then cp compose.proxy.oracle.yaml "$release/proxy.before.yaml"; fi
cp "$release/Caddyfile" Caddyfile
cp "$release/compose.proxy.oracle.yaml" compose.proxy.oracle.yaml
docker compose -f compose.proxy.oracle.yaml up -d --force-recreate
'@
    $shell = $shell.Replace('__DATABASE__',$(if ($dbCommand) { $database } else { '' })).Replace('__PROXY__',$(if ($DeployProxy) { $proxy } else { '' }))
    foreach ($pair in @(@('__ROOT__',$RemoteDirectory),@('__RELEASE__',$release),@('__COMPOSE__',$compose),@('__VARIABLE__',$variable),@('__IMAGE__',$image),@('__VERSION__',$Version),@('__MAINTENANCE__',$maintenance),@('__DBCOMMAND__',$dbCommand))) { $shell = $shell.Replace($pair[0],$pair[1]) }
    $shellPath = Join-Path $temporary 'deploy.sh'
    [IO.File]::WriteAllText($shellPath,($shell.Replace("`r`n","`n") + "`n"),(New-Object Text.UTF8Encoding($false)))
    Invoke-Native scp @('-i',$IdentityFile,'-o','BatchMode=yes',$shellPath,"${Server}:$release/deploy.sh")
    Invoke-Native ssh ($sshArgs + @($Server,"sh '$release/deploy.sh'"))
} finally {
    # Only generated files in this invocation's unique temporary directory.
    Get-ChildItem -LiteralPath $temporary -File | Remove-Item
    Remove-Item -LiteralPath $temporary
}
