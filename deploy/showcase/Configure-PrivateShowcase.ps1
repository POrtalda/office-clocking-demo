#requires -Version 7.2
[CmdletBinding()]
param([ValidateSet('Initialize','Configure','Check')][string]$Action = 'Initialize')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\')
$privateDirectory = 'C:\Office-Clocking-Secrets'
$seedFile = Join-Path $privateDirectory 'showcase-seed.env'
$runtimeFile = Join-Path $privateDirectory 'showcase-runtime.env'
$accountsFile = Join-Path $privateDirectory 'showcase-accounts.json'
$currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$templateMarker = '# OFFICE CLOCKING SHOWCASE PRIVATE TEMPLATE v1 - unconfigured'
$utf8 = [Text.UTF8Encoding]::new($false)
function Assert-OutsideRepository {
    $privateFull = [IO.Path]::GetFullPath($privateDirectory).TrimEnd('\')
    if ($privateFull.Equals($repoDirectory,[StringComparison]::OrdinalIgnoreCase) -or $privateFull.StartsWith($repoDirectory+'\',[StringComparison]::OrdinalIgnoreCase) -or $repoDirectory.StartsWith($privateFull+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'La cartella privata deve essere esterna e separata dal repository.' }
}
function Assert-PrivateAcl([string]$LiteralPath) {
    $item = Get-Item -LiteralPath $LiteralPath -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Link o junction non consentiti nella cartella privata.' }
    $acl = Get-Acl -LiteralPath $LiteralPath
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $currentSid.Value) { throw 'Il proprietario non corrisponde all utente corrente.' }
    $rules = @($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
    if ($rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $currentSid.Value -or $rules[0].AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or $rules[0].FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) { throw 'ACL non riservata esclusivamente all utente corrente.' }
    if ($item.PSIsContainer -and -not $acl.AreAccessRulesProtected) { throw 'Ereditarietà della cartella privata ancora attiva.' }
}
function Initialize-PrivateDirectory {
    Assert-OutsideRepository
    if (-not (Test-Path -LiteralPath $privateDirectory)) {
        $null = New-Item -ItemType Directory -Path $privateDirectory
        $acl = [Security.AccessControl.DirectorySecurity]::new()
        $acl.SetOwner($currentSid)
        $acl.SetAccessRuleProtection($true,$false)
        $rule = [Security.AccessControl.FileSystemAccessRule]::new($currentSid,[Security.AccessControl.FileSystemRights]::FullControl,([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit),[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
        $acl.AddAccessRule($rule)
        Set-Acl -LiteralPath $privateDirectory -AclObject $acl
    }
    # Existing directories are checked, never silently re-permissioned.
    Assert-PrivateAcl $privateDirectory
}
function Write-NewPrivateFile([string]$File,[string]$Text) {
    $stream = [IO.FileStream]::new($File,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $bytes=$utf8.GetBytes($Text); $stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
    Assert-PrivateAcl $File
}
function Seed-Template {
    return @"
$templateMarker
APP_ENV=showcase
SHOWCASE_ATLAS_HOST=showcasecluster.xed8r0t.mongodb.net
SHOWCASE_SEED_URI=
SHOWCASE_SEED_CONFIRM=office-clocking-remote-20261113
SHOWCASE_CREDENTIALS_FILE=$accountsFile
"@ + "`r`n"
}
function Runtime-Template {
    return @"
$templateMarker
APP_ENV=showcase
NODE_ENV=production
DEMO_MODE=true
DEMO_LOCAL_GPS_BYPASS=false
GEOLOCATION_CLOCK_IN_ENABLED=true
SHOWCASE_EMAIL_MODE=disabled
SHOWCASE_ADMIN_USERNAME=showcase_admin
CLIENT_URL=https://office-clocking-demo.netlify.app
SHOWCASE_API_URL=https://office-clocking-backend-demo.onrender.com
SHOWCASE_ATLAS_HOST=showcasecluster.xed8r0t.mongodb.net
MONGO_URI=
JWT_SECRET=
OFFICE_LAT=
OFFICE_LNG=
OFFICE_RADIUS_METERS=100
"@ + "`r`n"
}
function Read-PrivatePassword([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer); if ([string]::IsNullOrEmpty($plain)) { throw 'Password vuota.' }; return $plain }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
}
function New-CredentialUri([string]$Account,[string]$Password) {
    return 'mongodb+srv://'+[Uri]::EscapeDataString($Account)+':'+[Uri]::EscapeDataString($Password)+'@showcasecluster.xed8r0t.mongodb.net/office_clocking_showcase_20261113?retryWrites=true&w=majority&authSource=admin'
}
function Invoke-PrivateNode([string[]]$Arguments) {
    $node = (Get-Command node -CommandType Application).Source
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName=$node; $info.WorkingDirectory=Join-Path $repoDirectory 'backend'
    $info.UseShellExecute=$false; $info.CreateNoWindow=$true
    $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
    # Avoid inheriting old DB/SMTP/JWT/NODE_OPTIONS or other application configuration.
    $info.Environment.Clear()
    foreach($name in @('SystemRoot','WINDIR','TEMP','TMP','PATH','PATHEXT','USERPROFILE','APPDATA','LOCALAPPDATA')) {
        $value=[Environment]::GetEnvironmentVariable($name)
        if($value){ $info.Environment[$name]=$value }
    }
    foreach($argument in $Arguments){ $info.ArgumentList.Add($argument) }
    $process=[Diagnostics.Process]::new(); $process.StartInfo=$info
    try {
        $null=$process.Start()
        $readOutput=$process.StandardOutput.ReadToEndAsync(); $readError=$process.StandardError.ReadToEndAsync()
        if(-not $process.WaitForExit(30000)){ $process.Kill($true); throw 'Timeout del controllo offline.' }
        $output=$readOutput.GetAwaiter().GetResult(); $null=$readError.GetAwaiter().GetResult()
        return @{Code=$process.ExitCode;Output=$output}
    } finally { $process.Dispose() }
}
function Check-PrivateConfiguration {
    Assert-PrivateAcl $privateDirectory; Assert-PrivateAcl $seedFile; Assert-PrivateAcl $runtimeFile
    Write-Output 'Percorsi esterni al repository; proprietario e ACL riservati all utente corrente: OK.'
    $result = Invoke-PrivateNode @('scripts/showcaseOffline.js','--private-files')
    if($result.Code -ne 0){
        # This command emits only fixed status codes and missing variable NAMES, never values.
        if($result.Output){
            try {
                $diagnostic=$result.Output | ConvertFrom-Json
                $allowedNames=@('SHOWCASE_SEED_URI','MONGO_URI','JWT_SECRET','OFFICE_LAT','OFFICE_LNG','APP_ENV','NODE_ENV','DEMO_MODE','DEMO_LOCAL_GPS_BYPASS','GEOLOCATION_CLOCK_IN_ENABLED','SHOWCASE_EMAIL_MODE','SHOWCASE_ADMIN_USERNAME','CLIENT_URL','SHOWCASE_API_URL','SHOWCASE_ATLAS_HOST','SHOWCASE_SEED_CONFIRM','SHOWCASE_CREDENTIALS_FILE','OFFICE_RADIUS_METERS')
                $missingNames=@($diagnostic.seed.missing)+@($diagnostic.runtime.missing)
                $safeNames=@($missingNames | Where-Object { $_ -cin $allowedNames } | Select-Object -Unique)
                if($safeNames.Count){ Write-Output ('Variabili da completare privatamente: '+($safeNames -join ', ')) }
            } catch { Write-Output 'Esito non interpretabile; nessun output potenzialmente sensibile mostrato.' }
        }
        Write-Output 'Configurazione incompleta/non valida: inserire privatamente i valori richiesti. Bootstrap runtime non eseguito.'
        exit 2
    }
    Write-Output 'Profili privati seed/runtime, host, database e utenti separati: OK (solo validazione locale).'
    $profile = $result.Output | ConvertFrom-Json
    if($profile.seed.recoveryRequired){ Write-Output 'File account già presente: seed ordinario bloccato; serve recupero esplicitamente autorizzato, nessuna sovrascrittura.' }
    $runtimeCheck=Invoke-PrivateNode @("--env-file=$runtimeFile",'scripts/startRemoteShowcase.js','--check')
    if($runtimeCheck.Code -ne 0){ throw 'Verifica offline runtime non riuscita; nessun dettaglio sensibile viene mostrato.' }
    Write-Output 'Bootstrap runtime --check: OK. Nessuna connessione al database o porta aperta.'
}
try {
    Initialize-PrivateDirectory
    if($Action -eq 'Initialize') {
        if(-not (Test-Path -LiteralPath $seedFile)){ Write-NewPrivateFile $seedFile (Seed-Template) } else { Assert-PrivateAcl $seedFile }
        if(-not (Test-Path -LiteralPath $runtimeFile)){ Write-NewPrivateFile $runtimeFile (Runtime-Template) } else { Assert-PrivateAcl $runtimeFile }
        Write-Output 'Modelli privati predisposti senza sovrascrivere file esistenti. Nessun segreto generato o richiesto in questa fase.'
        Write-Output 'ACL e collocazione esterna al repository: OK.'
    } elseif($Action -eq 'Configure') {
        Assert-PrivateAcl $seedFile; Assert-PrivateAcl $runtimeFile
        if([IO.File]::ReadAllText($seedFile) -ne (Seed-Template) -or [IO.File]::ReadAllText($runtimeFile) -ne (Runtime-Template)) { throw 'File diversi dai modelli vuoti: nessuna sovrascrittura automatica di configurazioni esistenti.' }
        if(Test-Path -LiteralPath $accountsFile){ throw 'Il file credenziali dei partecipanti esiste già: interrompere e verificare privatamente.' }
        $seedPassword=Read-PrivatePassword 'Password Atlas ESISTENTE di showcase_seed (input nascosto)'
        $runtimePassword=Read-PrivatePassword 'Password Atlas ESISTENTE di showcase_runtime (input nascosto)'
        if($seedPassword -eq $runtimePassword){ throw 'Usare password distinte per i due utenti Atlas.' }
        $latitude=Read-Host 'Latitudine REALE della sede, punto decimale'
        $longitude=Read-Host 'Longitudine REALE della sede, punto decimale'
        $radius=Read-Host 'Raggio della sede, metri da 1 a 1000 (Invio = 100)'
        if(-not $radius){ $radius='100' }
        $style=[Globalization.NumberStyles]::Float; $culture=[Globalization.CultureInfo]::InvariantCulture
        $lat=0.0; $lng=0.0; $meters=0
        if(-not [double]::TryParse($latitude,$style,$culture,[ref]$lat) -or -not [double]::IsFinite($lat) -or [Math]::Abs($lat) -gt 90 -or -not [double]::TryParse($longitude,$style,$culture,[ref]$lng) -or -not [double]::IsFinite($lng) -or [Math]::Abs($lng) -gt 180 -or -not [int]::TryParse($radius,[ref]$meters) -or $meters -lt 1 -or $meters -gt 1000){ throw 'Sede o raggio non validi. Nessun file modificato.' }
        $seedUri=New-CredentialUri 'showcase_seed' $seedPassword
        $runtimeUri=New-CredentialUri 'showcase_runtime' $runtimePassword
        $random=[byte[]]::new(32); $randomGenerator=[Security.Cryptography.RandomNumberGenerator]::Create()
        try { $randomGenerator.GetBytes($random) } finally { $randomGenerator.Dispose() }
        $jwt=[Convert]::ToHexString($random).ToLowerInvariant()
        $seedText=(Seed-Template).Replace($templateMarker,'# Office Clocking Showcase - configurazione privata').Replace("SHOWCASE_SEED_URI=`r`n","SHOWCASE_SEED_URI=$seedUri`r`n")
        $runtimeText=(Runtime-Template).Replace($templateMarker,'# Office Clocking Showcase - configurazione privata').Replace("MONGO_URI=`r`n","MONGO_URI=$runtimeUri`r`n").Replace("JWT_SECRET=`r`n","JWT_SECRET=$jwt`r`n").Replace("OFFICE_LAT=`r`n","OFFICE_LAT=$latitude`r`n").Replace("OFFICE_LNG=`r`n","OFFICE_LNG=$longitude`r`n").Replace('OFFICE_RADIUS_METERS=100',"OFFICE_RADIUS_METERS=$meters")
        # Existing paths and ACLs are retained. Only exact empty templates may be populated.
        [IO.File]::WriteAllText($seedFile,$seedText,$utf8)
        [IO.File]::WriteAllText($runtimeFile,$runtimeText,$utf8)
        $seedPassword=$null; $runtimePassword=$null; $seedUri=$null; $runtimeUri=$null; $jwt=$null; $seedText=$null; $runtimeText=$null
        [Array]::Clear($random,0,$random.Length)
        Write-Output 'File compilati privatamente; nuova JWT generata e salvata senza mostrarla. Nessun seed eseguito.'
        Check-PrivateConfiguration
    } else { Check-PrivateConfiguration }
} catch {
    # Never print exception objects, expanded variables, URI or file contents.
    Write-Error 'Operazione interrotta. Verificare privatamente percorso, ACL, modelli e input; nessun seed o collegamento DB eseguito.' -ErrorAction Continue
    exit 1
}
