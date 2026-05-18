function normalizeDateText(value) {
  const text = String(value || '').trim();

  if (!text) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return '';
}

export function getAgeFromBirthDate(birthDate, referenceDate = new Date()) {
  const birthText = normalizeDateText(birthDate);

  if (!birthText) {
    return null;
  }

  const reference = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  if (Number.isNaN(reference.getTime())) {
    return null;
  }

  const birth = new Date(`${birthText}T00:00:00Z`);

  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  let age = reference.getUTCFullYear() - birth.getUTCFullYear();

  if (age < 0) {
    return null;
  }

  const referenceMonth = reference.getUTCMonth();
  const birthMonth = birth.getUTCMonth();
  const referenceDay = reference.getUTCDate();
  const birthDay = birth.getUTCDate();

  if (referenceMonth < birthMonth || (referenceMonth === birthMonth && referenceDay < birthDay)) {
    age -= 1;
  }

  return age;
}
