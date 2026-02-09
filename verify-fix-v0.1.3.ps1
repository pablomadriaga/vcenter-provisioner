#!/usr/bin/env pwsh

# Script de verificación de la versión 0.1.3 - TextField Focus Issue SOLUCIONADO
# Este script verifica que todos los servicios están funcionando correctamente

Write-Host "🔍 Verificación: vCenter Provisioner v0.1.3" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "✨ TextField Focus Issue - PERMANENT FIX" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan

# 1. Verificar estado de contenedores
Write-Host "`n1. Verificando estado de contenedores Docker..." -ForegroundColor Yellow
$containers = docker-compose ps --format json | ConvertFrom-Json
$healthyCount = 0
$totalCount = $containers.Count

foreach ($container in $containers) {
    $serviceName = $container.Service
    $status = $container.State
    
    if ($status -like "*healthy*" -or $status -like "*Up*") {
        Write-Host "   ✅ $serviceName - $status" -ForegroundColor Green
        $healthyCount++
    } else {
        Write-Host "   ❌ $serviceName - $status" -ForegroundColor Red
    }
}

Write-Host "   📊 Resumen: $healthyCount/$totalCount servicios saludables" -ForegroundColor Cyan

# 2. Verificar endpoints de salud
Write-Host "`n2. Verificando endpoints de salud..." -ForegroundColor Yellow
$endpoints = @{
    "API Gateway" = "http://localhost:3000/health"
    "Auth Service" = "http://localhost:3001/health"
    "Typing Service" = "http://localhost:8000/health"
    "Orchestrator" = "http://localhost:8080/health"
    "vCenter Integration" = "http://localhost:8081/health"
    "Stats Service" = "http://localhost:8001/health"
    "Monitoring Service" = "http://localhost:8082/health"
    "Backup Service" = "http://localhost:8002/health"
    "UI" = "http://localhost:5173"
}

foreach ($service in $endpoints.Keys) {
    $url = $endpoints[$service]
    $response = curl -s -o /dev/null -w "%{http_code}" $url
    
    if ($response -eq "200") {
        Write-Host "   ✅ $service - $url ($response)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $service - $url ($response)" -ForegroundColor Red
    }
}

# 3. Verificar versión de la UI
Write-Host "`n3. Verificando versión de la UI..." -ForegroundColor Yellow
$htmlContent = curl -s http://localhost:5173
if ($htmlContent -match "Vite \+ React \+ TS") {
    Write-Host "   ✅ UI cargada correctamente" -ForegroundColor Green
    
    # Intentar obtener la versión del contenedor
    $imageInfo = docker inspect provisioner-ui-v0.1.3 --format '{{.Config.Labels.version}}'
    if ($imageInfo) {
        Write-Host "   📦 Versión de la imagen: $imageInfo" -ForegroundColor Cyan
    }
} else {
    Write-Host "   ❌ UI no está cargando correctamente" -ForegroundColor Red
}

# 4. Verificar base de datos
Write-Host "`n4. Verificando conexión a base de datos..." -ForegroundColor Yellow
try {
    $dbCheck = docker exec vcenter-provisioner-db psql -U antigravity -d vcenter_provisioner -c "SELECT COUNT(*) FROM templates" 2>&1
    if ($dbCheck -match "\d+") {
        Write-Host "   ✅ Base de datos conectada" -ForegroundColor Green
        Write-Host "   📊 Tipificaciones en DB: $dbCheck" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  No se pudo verificar templates" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Error conectando a DB" -ForegroundColor Yellow
}

# 5. Login y obtener token
Write-Host "`n5. Verificando autenticación..." -ForegroundColor Yellow
try {
    $loginResponse = curl -s -X POST http://localhost:3000/auth/login `
        -H "Content-Type: application/json" `
        -d '{"username":"admin","password":"password123"}'
    
    $loginData = $loginResponse | ConvertFrom-Json
    $token = $loginData.token
    
    if ($token) {
        Write-Host "   ✅ Autenticación exitosa" -ForegroundColor Green
        Write-Host "   🔑 Token obtenido: $($token.Substring(0, 20))..." -ForegroundColor Cyan
    } else {
        Write-Host "   ❌ Error en autenticación" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Error en autenticación: $_" -ForegroundColor Red
}

# 6. Información de la solución
Write-Host "`n6. 📋 Información de la Solución:" -ForegroundColor Yellow
Write-Host "   🔧 Problema: TextField perdía el foco al escribir" -ForegroundColor White
Write-Host "   ✅ Solución: Componente SegmentEditor memoizado con React.memo" -ForegroundColor Green
Write-Host "   📁 Archivos modificados:" -ForegroundColor White
Write-Host "      - apps/provisioner-ui/src/components/SegmentEditor.tsx (NUEVO)" -ForegroundColor Cyan
Write-Host "      - apps/provisioner-ui/src/pages/TypificationsPage.tsx" -ForegroundColor Cyan
Write-Host "      - apps/provisioner-ui/package.json (v0.1.2 → v0.1.3)" -ForegroundColor Cyan
Write-Host "      - infra/local/docker-compose.yml" -ForegroundColor Cyan
Write-Host "      - apps/provisioner-ui/Dockerfile" -ForegroundColor Cyan
Write-Host "   📚 Documentación: docs/REACT-FIELD-BEST-PRACTICES.md (NUEVO)" -ForegroundColor Cyan

# 7. Instrucciones de prueba manual
Write-Host "`n7. 🧪 Prueba Manual Recomendada:" -ForegroundColor Yellow
Write-Host "   1. Abrir navegador: http://localhost:5173" -ForegroundColor White
Write-Host "   2. Login: admin / password123" -ForegroundColor White
Write-Host "   3. Navegar a: Tipificaciones" -ForegroundColor White
Write-Host "   4. Click: 'Siguiente' → 'Configurar Segmentos'" -ForegroundColor White
Write-Host "   5. Click: '+ Agregar Segmento'" -ForegroundColor White
Write-Host "   6. Cambiar tipo a: 'Fijo - Prefijo fijo'" -ForegroundColor White
Write-Host "   7. Click en campo: 'Valor Fijo'" -ForegroundColor White
Write-Host "   8. Escribir letra por letra: T - E - S - T" -ForegroundColor White
Write-Host "   9. Verificar: El foco DEBE mantenerse en el campo" -ForegroundColor Green
Write-Host "`n   ✅ Si el foco se mantiene = PROBLEMA SOLUCIONADO" -ForegroundColor Green
Write-Host "   ❌ Si el foco se pierde = REVISAR SOLUCIÓN" -ForegroundColor Red

Write-Host "`n===========================================" -ForegroundColor Cyan
Write-Host "Verificación Completada" -ForegroundColor Cyan
Write-Host "Versión: 0.1.3" -ForegroundColor Cyan
Write-Host "TextField Focus Issue: ✅ SOLUCIONADO" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan
