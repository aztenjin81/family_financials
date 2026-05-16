function asTrimmedString(value) {
  return String(value || '').trim();
}

export function normalizeAccountInput(input) {
  const accountGroup = asTrimmedString(input.accountGroup);
  const name = asTrimmedString(input.name);
  const subtitle = asTrimmedString(input.subtitle);
  const icon = asTrimmedString(input.icon || 'Bank');
  const ownerSlug = asTrimmedString(input.ownerSlug);
  const rawBalance = Number(input.balance);

  if (!accountGroup) {
    throw new Error('Account group is required');
  }

  if (!name) {
    throw new Error('Account name is required');
  }

  if (!ownerSlug) {
    throw new Error('Owner is required');
  }

  if (!Number.isFinite(rawBalance)) {
    throw new Error('Balance must be a number');
  }

  return {
    accountGroup,
    name,
    subtitle,
    icon,
    ownerSlug,
    balance: rawBalance,
  };
}

export function normalizeImportedAccountInput(input) {
  const account = normalizeAccountInput(input);
  const provider = asTrimmedString(input.provider);
  const externalItemId = asTrimmedString(input.externalItemId);
  const externalAccountId = asTrimmedString(input.externalAccountId);

  if (!provider) {
    throw new Error('Provider is required');
  }

  if (!externalAccountId) {
    throw new Error('External account id is required');
  }

  return {
    ...account,
    provider,
    externalItemId: externalItemId || null,
    externalAccountId,
  };
}
