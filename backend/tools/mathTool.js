/**
 * Herramienta: math.calculate()
 * Evaluación matemática segura sin eval
 */
async function calculate({ expression }) {
  if (!expression) return { error: 'Se requiere una expresión matemática.' };

  const sanitized = String(expression).replace(/[^0-9+\-*/().^%\s]/g, '');
  if (!sanitized.trim()) {
    return { error: 'Expresión matemática inválida.' };
  }

  try {
    // Evaluación segura mediante Function pura sin acceso a objetos globales
    const result = new Function(`'use strict'; return (${sanitized.replace(/\^/g, '**')});`)();
    return {
      type: 'math_card',
      data: {
        expression: sanitized,
        result: Number.isFinite(result) ? result : 'Indefinido'
      }
    };
  } catch (err) {
    return { error: `No se pudo calcular la expresión: ${sanitized}` };
  }
}

module.exports = { calculate };
