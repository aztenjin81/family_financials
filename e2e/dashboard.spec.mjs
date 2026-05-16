import { expect, test } from '@playwright/test';
import { DATA } from '../src/data.js';

function buildDashboardFixture() {
  const members = DATA.members.map((member) => ({ ...member }));
  const memberSlugByName = new Map(members.map((member) => [member.slug, member.slug]));
  const merchantSuggestions = [...new Set(DATA.transactions.flatMap((group) => group.items.map((item) => item.merch)))].sort((a, b) => a.localeCompare(b));

  return {
    family: DATA.family,
    householdMembers: members,
    merchantSuggestions,
    asOfDate: DATA.asOfDate,
    asOf: DATA.asOf,
    netWorth: DATA.netWorth,
    monthSpend: DATA.monthSpend,
    cashflow30: DATA.cashflow30,
    accounts: DATA.accounts.map((group, groupIndex) => ({
      group: group.group,
      items: group.items.map((item, itemIndex) => ({
        id: groupIndex * 100 + itemIndex + 1,
        group: group.group,
        name: item.name,
        sub: item.sub,
        icon: item.icon,
        bal: item.bal,
        owner: memberSlugByName.get(item.owner) || item.owner,
      })),
    })),
    spending: DATA.spending.map((category, index) => ({
      id: index + 1,
      cat: category.cat,
      color: category.color,
      spent: category.spent,
      budget: category.budget,
    })),
    forecast: DATA.forecast.map((week) => ({ ...week })),
    goals: DATA.goals.map((goal) => ({ ...goal })),
    transactions: DATA.transactions.map((group, groupIndex) => ({
      date: group.date,
      day: group.day,
      items: group.items.map((item, itemIndex) => ({
        id: groupIndex * 100 + itemIndex + 1,
        emoji: item.emoji,
        merch: item.merch,
        cat: item.cat,
        who: item.who,
        amt: item.amt,
        time: item.time,
        income: Boolean(item.income),
        postedDate: group.date,
      })),
    })),
    bills: DATA.bills.map((bill) => ({ ...bill })),
    investments: {
      ...DATA.investments,
      holdings: DATA.investments.holdings.map((holding) => ({ ...holding })),
    },
    debts: DATA.debts.map((debt) => ({ ...debt })),
    kids: DATA.kids.map((kid, index) => ({
      ...kid,
      id: index + 1,
      chores: kid.chores.map((chore, choreIndex) => ({
        id: index * 100 + choreIndex + 1,
        label: chore.label,
        reward: chore.reward,
        done: chore.done,
      })),
    })),
    insight: { ...DATA.insight },
  };
}

function getNextId(groups) {
  return groups.flatMap((group) => group.items || []).reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
}

function findAccountGroup(dashboard, groupName) {
  return dashboard.accounts.find((group) => group.group === groupName) || null;
}

function findTransactionById(dashboard, transactionId) {
  for (const group of dashboard.transactions) {
    const item = group.items.find((transaction) => transaction.id === transactionId);

    if (item) {
      return { group, item };
    }
  }

  return null;
}

test.describe('dashboard browser flows', () => {
  test.beforeEach(async ({ page }) => {
    let dashboard = buildDashboardFixture();

    await page.route('**/api/dashboard*', async (route) => {
      await route.fulfill({
        contentType: 'application/json; charset=utf-8',
        status: 200,
        body: JSON.stringify(dashboard),
      });
    });

    await page.route('**/api/transactions', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      const body = route.request().postDataJSON();
      const nextId = getNextId(dashboard.transactions);
      const postedDate = body.postedDate || dashboard.asOfDate;
      const postedGroup = dashboard.transactions.find((group) => group.date === postedDate) || dashboard.transactions[0];
      const amount = body.isIncome ? Math.abs(body.amount) : -Math.abs(body.amount);

      postedGroup.items.push({
        id: nextId,
        emoji: body.emoji,
        merch: body.merchant,
        cat: body.category,
        who: body.memberSlug,
        amt: amount,
        time: body.timeLabel,
        income: Boolean(body.isIncome),
        postedDate,
      });

      if (postedGroup.date !== postedDate) {
        postedGroup.date = postedDate;
      }

      await route.fulfill({
        contentType: 'application/json; charset=utf-8',
        status: 201,
        body: JSON.stringify({
          transaction: {
            id: nextId,
            postedDate,
            merchant: body.merchant,
            category: body.category,
            amount,
            timeLabel: body.timeLabel,
            emoji: body.emoji,
            isIncome: Boolean(body.isIncome),
          },
        }),
      });
    });

    await page.route('**/api/accounts', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      const body = route.request().postDataJSON();
      const nextId = getNextId(dashboard.accounts);
      const groupName = body.accountGroup || 'Cash';
      const group = findAccountGroup(dashboard, groupName) || (() => {
        const nextGroup = { group: groupName, items: [] };
        dashboard.accounts.push(nextGroup);
        return nextGroup;
      })();

      group.items.push({
        id: nextId,
        group: groupName,
        name: body.name,
        sub: body.subtitle,
        icon: body.icon,
        bal: Number(body.balance),
        owner: body.ownerSlug,
      });

      await route.fulfill({
        contentType: 'application/json; charset=utf-8',
        status: 201,
        body: JSON.stringify({
          account: {
            id: nextId,
            group: groupName,
            name: body.name,
            balance: Number(body.balance),
          },
        }),
      });
    });

    await page.route('**/api/transactions/*', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback();
        return;
      }

      const transactionId = Number(route.request().url().split('/').pop());
      const body = route.request().postDataJSON();
      const record = findTransactionById(dashboard, transactionId);

      if (!record) {
        await route.fulfill({
          contentType: 'application/json; charset=utf-8',
          status: 404,
          body: JSON.stringify({ error: 'Transaction not found' }),
        });
        return;
      }

      const nextAmount = body.isIncome ? body.amount : -Math.abs(body.amount);
      record.item.merch = body.merchant;
      record.item.cat = body.category;
      record.item.who = body.memberSlug;
      record.item.amt = nextAmount;
      record.item.time = body.timeLabel;
      record.item.emoji = body.emoji;
      record.item.income = Boolean(body.isIncome);
      record.item.postedDate = body.postedDate;
      record.group.date = body.postedDate;

      await route.fulfill({
        contentType: 'application/json; charset=utf-8',
        status: 200,
        body: JSON.stringify({
          transaction: {
            id: transactionId,
            postedDate: body.postedDate,
            postedLabel: record.group.day,
            merchant: record.item.merch,
            category: record.item.cat,
            amount: nextAmount,
            timeLabel: record.item.time,
            emoji: record.item.emoji,
            isIncome: record.item.income,
          },
        }),
      });
    });

    await page.goto('/');
    await expect(page.getByText('Recent activity')).toBeVisible();
  });

  test('transaction pencil opens the edit modal', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Edit Whole Foods Market' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit Whole Foods Market' }).click();

    await expect(page.locator('.modal-title').filter({ hasText: 'Edit activity' })).toBeVisible();
    await expect(page.getByLabel('Merchant')).toHaveValue('Whole Foods Market');
    await expect(page.getByLabel('Date')).toHaveValue('2026-05-11');
    await expect(page.getByRole('button', { name: 'Update transaction' })).toBeVisible();
  });

  test('transaction pencil saves an edited amount', async ({ page }) => {
    const row = page.locator('.txn').filter({ hasText: 'Whole Foods Market' });
    await page.getByRole('button', { name: 'Edit Whole Foods Market' }).click();

    const amountField = page.getByLabel('Amount');
    await amountField.fill('152.18');
    await page.getByRole('button', { name: 'Update transaction' }).click();

    await expect(page.locator('.modal-backdrop')).toHaveCount(0);
    await expect(row).toContainText('152.18');
  });

  test('transaction pencil submits the edited date', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit Whole Foods Market' }).click();

    const requestPromise = page.waitForRequest((request) => (
      request.method() === 'PATCH'
      && request.url().includes('/api/transactions/')
    ));

    await page.getByLabel('Date').fill('2026-05-10');
    await page.getByRole('button', { name: 'Update transaction' }).click();

    const request = await requestPromise;
    expect(request.postDataJSON().postedDate).toBe('2026-05-10');
  });

  test('merchant autocomplete fills transaction fields and saves the new activity', async ({ page }) => {
    await page.getByRole('button', { name: 'Add transaction' }).click();

    const modal = page.locator('.modal-panel');
    const merchant = page.getByLabel('Merchant');
    await merchant.fill('Blue Bottle Coffee');

    await expect(modal.getByLabel('Category')).toHaveValue('Dining out');
    await expect(modal.getByLabel('Member')).toHaveValue('stephanie');
    await expect(modal.getByLabel('Icon')).toHaveValue('☕');

    await page.getByLabel('Amount').fill('54.20');
    await page.getByRole('button', { name: 'Save transaction' }).click();

    await expect(page.locator('.modal-backdrop')).toHaveCount(0);
    const matchingRows = page.locator('.txn').filter({ hasText: 'Blue Bottle Coffee' });
    await expect(matchingRows).toHaveCount(2);
    await expect(matchingRows.last()).toContainText('54.20');
  });

  test('add account modal saves a new account into the rail', async ({ page }) => {
    await page.getByTitle('Add account').click();

    await page.getByLabel('Group').fill('Cash');
    await page.getByLabel('Name').fill('Rainy Day Fund');
    await page.getByLabel('Subtitle').fill('Vacation buffer');
    await page.getByLabel('Balance').fill('1250');
    await page.getByLabel('Owner').selectOption('john');
    await page.getByLabel('Icon').selectOption('Vault');

    await page.getByRole('button', { name: 'Save account' }).click();

    await expect(page.locator('.modal-backdrop')).toHaveCount(0);
    await expect(page.getByText('Rainy Day Fund')).toBeVisible();
    await expect(page.getByText('$1,250')).toBeVisible();
  });

  test('cancel closes the transaction modal without saving', async ({ page }) => {
    await page.getByRole('button', { name: 'Add transaction' }).click();
    await expect(page.locator('.modal-title').filter({ hasText: 'Add activity' })).toBeVisible();

    await page.getByLabel('Merchant').fill('New Merchant');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.locator('.modal-backdrop')).toHaveCount(0);
    await expect(page.locator('.txn').filter({ hasText: 'New Merchant' })).toHaveCount(0);
  });

  test('budget adjust action opens the budget modal', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Adjust budget' })).toBeVisible();

    await page.getByRole('button', { name: 'Adjust budget' }).click();

    await expect(page.locator('.modal-title').filter({ hasText: 'Adjust budget' })).toBeVisible();
    await expect(page.getByLabel('Monthly budget')).toBeVisible();
  });

  test('spending row adjust button opens the same modal', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Adjust Dining out budget' })).toBeVisible();

    await page.getByRole('button', { name: 'Adjust Dining out budget' }).click();

    await expect(page.locator('.modal-title').filter({ hasText: 'Adjust budget' })).toBeVisible();
    await expect(page.getByLabel('Monthly budget')).toHaveValue('450');
  });
});
