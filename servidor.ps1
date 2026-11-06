# ==============================================================================
# Gumbound Web 2026 - Control Interactivo de Servidores
# Inicia y detiene el Backend en Go (:8080) y el Frontend en Vite (:3000)
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$rootDir = $PSScriptRoot
if (-not $rootDir) { $rootDir = (Get-Location).Path }
Set-Location $rootDir

function Test-PortListening($port) {
    try {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        return ($null -ne $conn)
    } catch {
        return $false
    }
}

function Stop-GumboundServers {
    Write-Host ""
    Write-Host " Deteniendo servidores de Gumbound..." -ForegroundColor Yellow

    # 1. Detener procesos en puerto 8080 (Go Backend)
    $p8080 = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($p8080) {
        foreach ($pidToKill in $p8080) {
            try {
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                Write-Host "   [OK] Proceso en puerto 8080 (PID $pidToKill) detenido." -ForegroundColor Green
            } catch {}
        }
    }

    # 2. Detener procesos en puerto 3000 (Vite Client)
    $p3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($p3000) {
        foreach ($pidToKill in $p3000) {
            try {
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                Write-Host "   [OK] Proceso en puerto 3000 (PID $pidToKill) detenido." -ForegroundColor Green
            } catch {}
        }
    }

    # 3. Detener cualquier instancia de server.exe
    $serverProcs = Get-Process server -ErrorAction SilentlyContinue
    if ($serverProcs) {
        foreach ($p in $serverProcs) {
            try {
                $srvId = $p.Id
                Stop-Process -Id $srvId -Force -ErrorAction SilentlyContinue
                Write-Host "   [OK] server.exe (PID $srvId) cerrado." -ForegroundColor Green
            } catch {}
        }
    }

    Start-Sleep -Seconds 1
    $is8080 = Test-PortListening 8080
    $is3000 = Test-PortListening 3000

    if (-not $is8080 -and -not $is3000) {
        Write-Host ""
        Write-Host " [OK] Todos los servidores han sido DETENIDOS correctamente." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host " [!] Algunos puertos aún siguen ocupados. Verifique el Administrador de Tareas." -ForegroundColor Red
    }
}

function Start-GumboundServers {
    Write-Host ""
    Write-Host " Iniciando servidores de Gumbound Web 2026..." -ForegroundColor Cyan

    $serverExe = Join-Path $rootDir "apps\server\server.exe"
    $serverDir = Join-Path $rootDir "apps\server"

    # 1. Verificar o compilar servidor Go
    if (-not (Test-Path $serverExe)) {
        Write-Host "   [*] Compilando servidor Go (apps/server/server.exe)..." -ForegroundColor Yellow
        Push-Location $serverDir
        go build -o server.exe main.go
        Pop-Location
    }

    # 2. Arrancar Servidor Go si no está escuchando
    if (-not (Test-PortListening 8080)) {
        Write-Host "   [*] Levantando Backend Go en puerto 8080..." -ForegroundColor Yellow
        Start-Process -FilePath $serverExe -WorkingDirectory $serverDir -WindowStyle Minimized
    } else {
        Write-Host "   [i] El Backend Go ya esta activo en el puerto 8080." -ForegroundColor Cyan
    }

    # 3. Arrancar Cliente Web Vite si no está escuchando
    if (-not (Test-PortListening 3000)) {
        Write-Host "   [*] Levantando Cliente Vite en puerto 3000..." -ForegroundColor Yellow
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c pnpm --filter client dev" -WorkingDirectory $rootDir -WindowStyle Minimized
    } else {
        Write-Host "   [i] El Cliente Vite ya esta activo en el puerto 3000." -ForegroundColor Cyan
    }

    # 4. Esperar y confirmar estado
    Write-Host "   [*] Verificando inicio de servicios..." -ForegroundColor Gray
    $timeout = 10
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 1
        $elapsed++
        if ((Test-PortListening 8080) -and (Test-PortListening 3000)) {
            break
        }
    }

    $is8080 = Test-PortListening 8080
    $is3000 = Test-PortListening 3000

    Write-Host ""
    if ($is8080 -and $is3000) {
        Write-Host " =========================================================" -ForegroundColor Green
        Write-Host "  SERVIDORES INICIADOS EXITOSAMENTE!" -ForegroundColor Green
        Write-Host " =========================================================" -ForegroundColor Green
        Write-Host "   * Cliente Web:  http://localhost:3000" -ForegroundColor Cyan
        Write-Host "   * Servidor Go:  http://localhost:8080 (WS: /ws)" -ForegroundColor Cyan
        Write-Host " =========================================================" -ForegroundColor Green
    } else {
        Write-Host " [!] Advertencia en el arranque:" -ForegroundColor Yellow
        Write-Host "   - Backend (:8080): $(if ($is8080) {'Activo'} else {'No respondio aun'})" -ForegroundColor $(if ($is8080) {'Green'} else {'Red'})
        Write-Host "   - Cliente (:3000): $(if ($is3000) {'Activo'} else {'No respondio aun'})" -ForegroundColor $(if ($is3000) {'Green'} else {'Red'})
    }
}

# --- Pantalla Principal e Interacción ---
Clear-Host
$running8080 = Test-PortListening 8080
$running3000 = Test-PortListening 3000
$isAnyRunning = $running8080 -or $running3000

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "        GUMBOUND WEB 2026 - CONTROL DE SERVIDORES        " -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host " Estado actual:" -ForegroundColor White
Write-Host "   * Servidor Backend Go (:8080) : " -NoNewline
if ($running8080) { Write-Host "ACTIVO (En linea)" -ForegroundColor Green } else { Write-Host "DETENIDO (Apagado)" -ForegroundColor Red }
Write-Host "   * Cliente Web Vite    (:3000) : " -NoNewline
if ($running3000) { Write-Host "ACTIVO (En linea)" -ForegroundColor Green } else { Write-Host "DETENIDO (Apagado)" -ForegroundColor Red }
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

if ($isAnyRunning) {
    # Si ya están activos, preguntar si desea detener o reiniciar
    Write-Host " Los servidores se encuentran actualmente ACTIVOS." -ForegroundColor Yellow
    Write-Host " Quieres DETENER el servidor? [S = Si / N = No / R = Reiniciar]: " -NoNewline -ForegroundColor White
    $resp = Read-Host
    if ($null -ne $resp) { $resp = $resp.Trim().ToLower() } else { $resp = "n" }

    if ($resp -eq "s" -or $resp -eq "si" -or $resp -eq "sí" -or $resp -eq "y" -or $resp -eq "yes" -or $resp -eq "1") {
        Stop-GumboundServers
    } elseif ($resp -eq "r" -or $resp -eq "reiniciar") {
        Stop-GumboundServers
        Start-Sleep -Seconds 1
        Start-GumboundServers
    } else {
        Write-Host " Operacion cancelada. Los servidores continuan activos." -ForegroundColor Gray
    }
} else {
    # Si están detenidos, preguntar si desea iniciar
    Write-Host " Los servidores se encuentran actualmente DETENIDOS." -ForegroundColor DarkYellow
    Write-Host " Quieres INICIAR el servidor? [S = Si / N = No]: " -NoNewline -ForegroundColor White
    $resp = Read-Host
    if ($null -ne $resp) { $resp = $resp.Trim().ToLower() } else { $resp = "n" }

    if ($resp -eq "s" -or $resp -eq "si" -or $resp -eq "sí" -or $resp -eq "y" -or $resp -eq "yes" -or $resp -eq "1") {
        Start-GumboundServers
    } else {
        Write-Host " Operacion cancelada. No se inicio ningun servidor." -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Fin de la operacion." -ForegroundColor DarkGray
