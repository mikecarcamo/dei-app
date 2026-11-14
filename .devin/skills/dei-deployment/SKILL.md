---
name: dei-deployment
description: Consultar las URLs de despliegue del proyecto DEI en Netlify y Railway.
---

# DEI: URLs de despliegue

- Aplicación: DEI - Sistema de Test Psicológicos.
- Frontend y acceso en Netlify: https://dei-app.netlify.app/login
- URL del frontend proporcionada por el usuario.
- API en Railway configurada en frontend/netlify.toml: https://dei-app-production.up.railway.app/api
- Health del backend: https://dei-app-production.up.railway.app/api/health
- Railway sirve la API, no la interfaz. La raíz / puede responder «Ruta no encontrada: GET /».
- No almacenar usuarios, contraseñas ni secretos en esta skill.
