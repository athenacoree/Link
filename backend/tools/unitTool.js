/**
 * Herramienta: unit.convert()
 * Conversión de unidades estándar (temperatura, longitud, peso)
 */
async function convertUnits({ value, from, to }) {
  const val = parseFloat(value);
  if (isNaN(val)) return { error: 'Valor numérico inválido.' };

  const f = (from || '').toLowerCase().trim();
  const t = (to || '').toLowerCase().trim();

  let res = val;
  let unitName = t;

  if ((f === 'c' || f === 'celsius') && (t === 'f' || t === 'fahrenheit')) {
    res = (val * 9 / 5) + 32;
    unitName = '°F';
  } else if ((f === 'f' || f === 'fahrenheit') && (t === 'c' || t === 'celsius')) {
    res = (val - 32) * 5 / 9;
    unitName = '°C';
  } else if ((f === 'km' || f === 'kilometros') && (t === 'mi' || t === 'millas')) {
    res = val * 0.621371;
    unitName = 'millas';
  } else if ((f === 'mi' || f === 'millas') && (t === 'km' || t === 'kilometros')) {
    res = val * 1.60934;
    unitName = 'km';
  } else if ((f === 'kg' || f === 'kilos') && (t === 'lb' || t === 'libras')) {
    res = val * 2.20462;
    unitName = 'libras';
  } else if ((f === 'lb' || f === 'libras') && (t === 'kg' || t === 'kilos')) {
    res = val / 2.20462;
    unitName = 'kg';
  }

  return {
    type: 'unit_card',
    data: {
      original_value: val,
      from_unit: from,
      converted_value: Math.round(res * 100) / 100,
      to_unit: unitName,
    }
  };
}

module.exports = { convertUnits };
