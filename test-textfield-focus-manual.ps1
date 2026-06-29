#!/usr/bin/env pwsh

# Script de prueba manual para el TextField Focus Issue
# Este script verifica que los TextField mantengan el foco al escribir

Write-Host "🔍 Prueba Manual: TextField Focus Issue" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Verificar que la UI está disponible
Write-Host "`n1. Verificando disponibilidad de la UI..." -ForegroundColor Yellow
$uiResponse = curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
if ($uiResponse -eq "200") {
    Write-Host "   ✅ UI disponible en http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "   ❌ UI no disponible (código: $uiResponse)" -ForegroundColor Red
    exit 1
}

# 2. Verificar que el API Gateway esté disponible
Write-Host "`n2. Verificando API Gateway..." -ForegroundColor Yellow
$gatewayResponse = curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health
if ($gatewayResponse -eq "200") {
    Write-Host "   ✅ API Gateway disponible en http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "   ❌ API Gateway no disponible (código: $gatewayResponse)" -ForegroundColor Red
    exit 1
}

# 3. Verificar que el Auth Service esté disponible
Write-Host "`n3. Verificando Auth Service..." -ForegroundColor Yellow
$authResponse = curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health
if ($authResponse -eq "200") {
    Write-Host "   ✅ Auth Service disponible en http://localhost:3001" -ForegroundColor Green
} else {
    Write-Host "   ❌ Auth Service no disponible (código: $authResponse)" -ForegroundColor Red
    exit 1
}

# 4. Verificar que el Typing Service esté disponible
Write-Host "`n4. Verificando Typing Service..." -ForegroundColor Yellow
$typingResponse = curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health
if ($typingResponse -eq "200") {
    Write-Host "   ✅ Typing Service disponible en http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "   ❌ Typing Service no disponible (código: $typingResponse)" -ForegroundColor Red
    exit 1
}

# 5. Login para obtener token
Write-Host "`n5. Autenticando con usuario de prueba..." -ForegroundColor Yellow
$loginResponse = curl -s -X POST http://localhost:3000/auth/login `
    -H "Content-Type: application/json" `
    -d '{"username":"admin","password":"password123"}'

$token = ($loginResponse | ConvertFrom-Json).token
if ($token) {
    Write-Host "   ✅ Login exitoso, token obtenido" -ForegroundColor Green
} else {
    Write-Host "   ❌ Login falló" -ForegroundColor Red
    exit 1
}

# 6. Crear una tipificación de prueba
Write-Host "`n6. Creando tipificación de prueba..." -ForegroundColor Yellow
$templateResponse = curl -s -X POST http://localhost:3000/typing/templates `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -d "{\"name\":\"Prueba TextField Focus\",\"description\":\"Tipificación para probar el problema de foco en TextField\",\"prefix\":\"TEST\",\"vmClass\":\"medium\",\"segments\":[{\"type\":\"fixed\",\"length\":3},{\"type\":\"fixed\",\"length\":3},{\"type\":\"auto_seq\",\"length\":4}]}"

$templateId = ($templateResponse | ConvertFrom-Json).id
if ($templateId) {
    Write-Host "   ✅ Tipificación creada con ID: $templateId" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error creando tipificación" -ForegroundColor Red
    exit 1
}

# 7. Verificar versión de la UI
Write-Host "`n7. Verificando versión de la UI..." -ForegroundColor Yellow
$htmlContent = curl -s http://localhost:5173
if ($htmlContent -match "Vite \+ React \+ TS") {
    Write-Host "   ✅ UI cargada correctamente" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  UI puede no estar actualizada" -ForegroundColor Yellow
}

# 8. Información sobre la prueba manual
Write-Host "`n8. Prueba Manual Requerida:" -ForegroundColor Yellow
Write-Host "   Por favor, sigue estos pasos en el navegador:" -ForegroundColor White
Write-Host "   1. Abrir http://localhost:5173" -ForegroundColor White
Write-Host "   2. Login con usuario: admin, contraseña: password123" -ForegroundColor White
Write-Host "   3. Navegar a Tipificaciones" -ForegroundColor White
Write-Host "   4. Click en 'Siguiente' para ir a 'Configurar Segmentos'" -ForegroundColor White
Write-Host "   5. Click en '+ Agregar Segmento'" -ForegroundColor White
Write-Host "   6. Cambiar el tipo a 'Fijo - Prefijo fijo'" -ForegroundColor White
Write-Host "   7. Click en el campo 'Valor Fijo'" -ForegroundColor White
Write-Host "   8. Escribir letras una por una: T-E-S-T-P-R-D" -ForegroundColor White
Write-Host "   9. El foco DEBE mantenerse en el campo mientras escribes" -ForegroundColor White
Write-Host "`n   ✅ Si el foco se mantiene = PROBLEMA SOLUCIONADO" -ForegroundColor Green
Write-Host "   ❌ Si el foco se pierde = PROBLEMA PERSISTE" -ForegroundColor Red

# 9. Verificar logs de Docker
Write-Host "`n9. Verificando logs del contenedor UI..." -ForegroundColor Yellow
$logs = docker logs --tail=10 provisioner-ui-v0.1.3 2>&1
if ($logs -match "nginx") {
    Write-Host "   ✅ Contenedor UI corriendo correctamente" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Puede haber problemas con el contenedor UI" -ForegroundColor Yellow
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "Prueba Manual Completada" -ForegroundColor Cyan
Write-Host "Versión de la UI: 0.1.3" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
