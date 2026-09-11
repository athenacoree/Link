// Lee ADMIN_EMAILS (correos separados por coma) de las variables de
// entorno. Cualquier cuenta que inicie sesión o se registre con uno de
// esos correos se promueve a administrador automáticamente. Así, Luis
// (o quien administre el despliegue en Render) solo necesita poner su
// correo ahí para tener acceso al panel de administrador — nadie más
// puede volverse administrador por su cuenta.
function listaAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function esCorreoDeAdmin(email) {
  if (!email) return false;
  return listaAdminEmails().includes(String(email).trim().toLowerCase());
}

module.exports = { esCorreoDeAdmin };
