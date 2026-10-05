(function (root) {
  'use strict';
  const dayMs = 86400000;
  const categories = ['Logement', 'Alimentation', 'Transport', 'Restaurants', 'Santé', 'Loisirs', 'Abonnements', 'Achats', 'Factures', 'Famille', 'Maison', 'Services', 'Soins personnels', 'Voyages', 'Cadeaux', 'Espèces', 'Transferts', 'Revenus', 'À classer'];
  function iso(date) { return date.toISOString().slice(0, 10); }
  function date(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date invalide.');
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || iso(parsed) !== value) throw new Error('Date invalide.');
    return parsed;
  }
  function addDays(value, count) { return iso(new Date(date(value).getTime() + count * dayMs)); }
  function shiftMonth(value, count) {
    const original = date(value), target = new Date(Date.UTC(original.getUTCFullYear(), original.getUTCMonth() + count, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(original.getUTCDate(), last));
    return iso(target);
  }
  function shiftPeriod(period, count) {
    const start = shiftMonth(period.start, count), shifted = shiftMonth(period.end, count), originalEnd = date(period.end), targetEnd = date(shifted);
    const lastOriginal = new Date(Date.UTC(originalEnd.getUTCFullYear(), originalEnd.getUTCMonth() + 1, 0)).getUTCDate();
    const end = originalEnd.getUTCDate() === lastOriginal ? iso(new Date(Date.UTC(targetEnd.getUTCFullYear(), targetEnd.getUTCMonth() + 1, 0))) : shifted;
    return { start, end };
  }
  function range(preset, reference) {
    const end = reference, current = date(end), monthStart = `${end.slice(0, 7)}-01`;
    if (preset === 'month') return { start: monthStart, end };
    if (preset === 'previous') { const start = shiftMonth(monthStart, -1); return { start, end: addDays(monthStart, -1) }; }
    if (preset === 'six') return { start: shiftMonth(monthStart, -5), end };
    if (preset === 'year') return { start: `${end.slice(0, 4)}-01-01`, end };
    if (preset === 'quarter') return { start: iso(new Date(Date.UTC(current.getUTCFullYear(), Math.floor(current.getUTCMonth() / 3) * 3, 1))), end };
    throw new Error('Période inconnue.');
  }
  function days(start, end) {
    const count = Math.round((date(end) - date(start)) / dayMs) + 1;
    if (count < 1 || count > 3660) throw new Error('Choisir une période de 1 à 3 660 jours.');
    return Array.from({ length: count }, (_, index) => addDays(start, index));
  }
  function bucket(value, granularity) {
    const parsed = date(value);
    if (granularity === 'week') return addDays(value, -((parsed.getUTCDay() + 6) % 7));
    if (granularity === 'month') return `${value.slice(0, 7)}-01`;
    if (granularity === 'quarter') return iso(new Date(Date.UTC(parsed.getUTCFullYear(), Math.floor(parsed.getUTCMonth() / 3) * 3, 1)));
    if (granularity === 'year') return `${value.slice(0, 4)}-01-01`;
    return value;
  }
  function selectedAccounts(state, scope) { return state.accounts.filter(account => scope === 'all' || account.id === scope); }
  function selectedRows(state, context) {
    const ids = new Set(selectedAccounts(state, context.scope).map(account => account.id));
    return state.transactions.filter(row => ids.has(row.account) && row.date >= context.start && row.date <= context.end);
  }
  function balance(state, scope, onDate) {
    const accounts = selectedAccounts(state, scope);
    if (!accounts.length || accounts.some(account => onDate < account.openingDate)) return null;
    return accounts.reduce((total, account) => total + account.opening + state.transactions.filter(row => row.account === account.id && row.status !== 'pending' && row.date >= account.openingDate && row.date <= onDate).reduce((sum, row) => sum + row.amount, 0), 0);
  }
  function metrics(state, context) {
    const rows = selectedRows(state, context), posted = rows.filter(row => row.status !== 'pending');
    const income = posted.filter(row => row.kind === 'income').reduce((sum, row) => sum + row.amount, 0);
    const expenses = -posted.filter(row => row.kind === 'expense').reduce((sum, row) => sum + row.amount, 0);
    const groups = new Map();
    for (const value of days(context.start, context.end)) {
      const key = bucket(value, context.granularity);
      if (!groups.has(key)) groups.set(key, { date: key, end: value, income: 0, expenses: 0, balance: null });
      groups.get(key).end = value;
    }
    for (const row of posted) {
      const group = groups.get(bucket(row.date, context.granularity));
      if (row.kind === 'income') group.income += row.amount;
      if (row.kind === 'expense') group.expenses -= row.amount;
    }
    const accounts = selectedAccounts(state, context.scope);
    const through = accounts.length ? accounts.reduce((earliest, account) => account.throughDate < earliest ? account.throughDate : earliest, accounts[0].throughDate) : null;
    for (const group of groups.values()) group.balance = through && group.end <= through ? balance(state, context.scope, group.end) : null;
    const categoriesTotal = categories.map(name => ({ name, amount: -posted.filter(row => row.kind === 'expense' && row.category === name).reduce((sum, row) => sum + row.amount, 0) })).filter(item => item.amount > 0).sort((first, second) => second.amount - first.amount);
    return { rows, income, expenses, net: income - expenses, balance: through ? balance(state, context.scope, context.end < through ? context.end : through) : null, through, categories: categoriesTotal, series: [...groups.values()] };
  }
  function budgetAllowance(limit, start, end) {
    return Math.round(days(start, end).reduce((sum, value) => { const parsed = date(value), count = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0)).getUTCDate(); return sum + limit / count; }, 0));
  }
  function budgets(state, context) {
    const rows = selectedRows(state, context).filter(row => row.status !== 'pending' && row.kind === 'expense');
    return Object.entries(state.budgets).map(([category, monthly]) => {
      const limit = budgetAllowance(monthly, context.start, context.end), spent = -rows.filter(row => row.category === category).reduce((sum, row) => sum + row.amount, 0);
      return { category, monthly, limit, spent, remaining: limit - spent };
    });
  }
  function budgetSummary(state, context) {
    const envelopes = budgets(state, context), monthly = state.monthlyBudget ?? Object.values(state.budgets).reduce((sum, amount) => sum + amount, 0);
    const limit = budgetAllowance(monthly, context.start, context.end), spent = metrics(state, context).expenses;
    return { monthly, limit, spent, remaining: limit - spent, envelopes, allocatedMonthly: Object.values(state.budgets).reduce((sum, amount) => sum + amount, 0) };
  }
  function detectRecurring(state, through, scope = 'all') {
    const groups = new Map();
    for (const row of state.transactions.filter(row => row.kind === 'expense' && row.status !== 'pending' && row.date <= through && (scope === 'all' || row.account === scope))) {
      const key = JSON.stringify([row.account, row.merchant.trim().toLocaleLowerCase('fr')]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const result = [];
    for (const [id, source] of groups) {
      const rows = source.sort((first, second) => first.date.localeCompare(second.date));
      if (rows.some(row => row.recurrence === 'exclude')) continue;
      const explicit = rows.findLast(row => row.recurrence === 'include'), gaps = rows.slice(1).map((row, index) => Math.round((date(row.date) - date(rows[index].date)) / dayMs));
      const average = Math.round(rows.reduce((sum, row) => sum - row.amount, 0) / rows.length);
      const stable = rows.every(row => Math.abs(-row.amount - average) <= Math.max(100, average * .2));
      const frequency = explicit?.recurrenceFrequency || (gaps.length && gaps.every(gap => gap >= 5 && gap <= 9) ? 'weekly' : gaps.length && gaps.every(gap => gap >= 25 && gap <= 35) ? 'monthly' : gaps.length && gaps.every(gap => gap >= 330 && gap <= 400) ? 'yearly' : null);
      if (!explicit && (rows.length < 2 || !stable || !frequency)) continue;
      const last = rows.at(-1), selectedFrequency = frequency || 'monthly';
      const anchor = rows[0].date, monthDistance = (date(last.date).getUTCFullYear() - date(anchor).getUTCFullYear()) * 12 + date(last.date).getUTCMonth() - date(anchor).getUTCMonth();
      const nextDate = selectedFrequency === 'weekly' ? addDays(last.date, 7) : shiftMonth(anchor, monthDistance + (selectedFrequency === 'yearly' ? 12 : 1));
      result.push({ id, name: last.merchant, account: last.account, category: last.category, amount: -last.amount, average, frequency: selectedFrequency, nextDate, lastDate: last.date, rows, confidence: explicit ? 'reviewed' : rows.length >= 3 ? 'observed' : 'candidate', monthly: Math.round(average * (selectedFrequency === 'yearly' ? 1 / 12 : selectedFrequency === 'weekly' ? 52 / 12 : 1)) });
    }
    return result.sort((first, second) => second.monthly - first.monthly);
  }
  function incomeRatio(state, context) {
    const rows = selectedRows(state, { ...context, scope: 'all' }).filter(row => row.kind === 'income' && row.status !== 'pending');
    const income = owner => rows.filter(row => state.accounts.find(account => account.id === row.account)?.owner === owner).reduce((sum, row) => sum + row.amount, 0);
    const incomeA = income('a'), incomeB = income('b'), complete = ['a', 'b'].every(owner => state.accounts.some(account => account.owner === owner));
    return { incomeA, incomeB, ratio: complete && incomeA + incomeB > 0 ? incomeA / (incomeA + incomeB) * 100 : state.household.ratio, source: complete && incomeA + incomeB > 0 ? 'income' : 'fallback' };
  }
  function sharing(state, context) {
    const rows = selectedRows(state, context).filter(row => row.kind === 'expense' && row.status !== 'pending');
    const rule = incomeRatio(state, context), allocations = [];
    let paidA = 0, paidB = 0, paidJoint = 0, shareA = 0, shareB = 0;
    for (const row of rows) {
      const owner = state.accounts.find(account => account.id === row.account)?.owner;
      const automatic = row.splitMode === 'auto' || row.splitMode === undefined && row.splitA === state.household.ratio;
      const ratio = !row.shared && owner !== 'joint' ? owner === 'a' ? 100 : 0 : automatic ? rule.ratio : row.splitA;
      const amount = -row.amount, partA = Math.round(amount * ratio / 100);
      allocations.push({ row, amount, partA, partB: amount - partA, ratio, automatic, owner });
      if (owner === 'joint') { paidJoint += amount; continue; }
      if (owner === 'a') paidA += amount; else if (owner === 'b') paidB += amount;
      shareA += partA; shareB += amount - partA;
    }
    const settlements = selectedRows(state, context).filter(row => row.kind === 'settlement' && row.amount < 0 && row.status !== 'pending');
    let owedToA = paidA - shareA;
    for (const row of settlements) owedToA += state.accounts.find(account => account.id === row.account)?.owner === 'a' ? -row.amount : row.amount;
    return { rows, allocations, rule, paidA, paidB, paidJoint, shareA, shareB, owedToA, settlements };
  }
  function occurrences(state, start, end, scope = 'all') {
    const result = [];
    for (const item of state.recurring.filter(item => item.active && (scope === 'all' || item.account === scope))) {
      let current = item.nextDate, index = 0;
      while (current <= end && index < 4000) {
        if (current >= start) result.push({ ...item, date: current });
        index++;
        current = item.frequency === 'weekly' ? addDays(item.nextDate, index * 7) : shiftMonth(item.nextDate, index * (item.frequency === 'yearly' ? 12 : 1));
      }
    }
    return result.sort((first, second) => first.date.localeCompare(second.date));
  }
  function parseAmount(value) {
    let normalized = String(value ?? '').trim().replace(/[\s\u00a0\u202f€]/g, '');
    if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.');
    if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Montant invalide.');
    const cents = Math.round(Number(normalized) * 100);
    if (!Number.isSafeInteger(cents)) throw new Error('Montant hors limites.');
    return cents;
  }
  function csvDate(value) {
    const text = String(value ?? '').trim();
    const french = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    const formatted = french ? `${french[3]}-${french[2]}-${french[1]}` : text;
    date(formatted); return formatted;
  }
  function normalizeRows(input, mapping, account) {
    const errors = [], rows = [];
    input.forEach((raw, index) => {
      try {
        let amount;
        if (mapping.amount) amount = parseAmount(raw[mapping.amount]);
        else amount = (String(raw[mapping.credit] ?? '').trim() ? Math.abs(parseAmount(raw[mapping.credit])) : 0) - (String(raw[mapping.debit] ?? '').trim() ? Math.abs(parseAmount(raw[mapping.debit])) : 0);
        const direction = String(raw[mapping.direction] ?? '').trim().toLowerCase();
        if (['income', 'credit', 'in', 'revenu', 'crédit'].includes(direction)) amount = Math.abs(amount);
        else if (['expense', 'debit', 'out', 'dépense', 'débit'].includes(direction)) amount = -Math.abs(amount);
        else if (direction && !['transfer', 'transfert'].includes(direction)) throw new Error('Direction non reconnue.');
        const merchant = String(raw[mapping.merchant] ?? '').trim();
        if (!merchant) throw new Error('Libellé absent.');
        const rowDate = csvDate(raw[mapping.date]);
        const status = String(raw[mapping.status] ?? '').toLowerCase() === 'pending' ? 'pending' : 'posted';
        const aliases = { Food: 'Alimentation', Housing: 'Logement', Transport: 'Transport', Health: 'Santé', Leisure: 'Loisirs', Entertainment: 'Loisirs', Shopping: 'Achats', Bills: 'Factures', Family: 'Famille', Home: 'Maison', Services: 'Services', 'Personal Care': 'Soins personnels', Travel: 'Voyages', Gifts: 'Cadeaux', Cash: 'Espèces', Transfers: 'Transferts', Income: 'Revenus' };
        const sourceCategory = String(raw[mapping.category] ?? '').trim(), translated = aliases[sourceCategory] || sourceCategory;
        const category = categories.includes(translated) ? translated : amount > 0 ? 'Revenus' : 'À classer';
        const affirmative = value => ['true', '1', 'y', 'yes', 'oui', 'o'].includes(String(value ?? '').trim().toLowerCase());
        const internal = affirmative(raw[mapping.internal]);
        rows.push({ id: root.crypto?.randomUUID?.() || `row-${index}-${Date.now()}`, account, date: rowDate, merchant, bankLabel: String(raw[mapping.bankLabel] ?? merchant).trim() || merchant, bankDetail: String(raw[mapping.bankDetail] ?? '').trim(), sourceId: String(raw[mapping.sourceId] ?? '').trim(), sourceCategory, amount, status, category, kind: internal || ['transfer', 'transfert'].includes(direction) ? 'transfer' : amount >= 0 ? 'income' : 'expense', shared: affirmative(raw[mapping.shared]), splitA: 50, splitMode: 'auto', note: '' });
      } catch (error) { errors.push({ line: index + 2, message: error.message }); }
    });
    return { rows, errors };
  }
  function fingerprint(row) { return row.sourceId ? JSON.stringify([row.account, row.sourceId, row.status]) : JSON.stringify([row.account, row.date, row.amount, row.bankDetail || row.bankLabel, row.status]); }
  function reconciliation(state, accountId, newRows, closingDate, closing) {
    const account = state.accounts.find(item => item.id === accountId);
    if (!account || closingDate < account.openingDate) throw new Error('Le contrôle doit être postérieur au solde d’ouverture.');
    const candidate = { ...state, transactions: state.transactions.concat(newRows) };
    const expected = balance(candidate, accountId, closingDate);
    return { expected, observed: closing, difference: closing - expected };
  }
  function validateState(value) {
    if (!value || value.schema !== 1 || !['demo', 'personal'].includes(value.mode) || !Array.isArray(value.accounts) || !Array.isArray(value.transactions) || !Array.isArray(value.recurring) || !value.budgets || !value.household || value.accounts.length > 100 || value.transactions.length > 100000) throw new Error('Sauvegarde incompatible.');
    const ids = new Set();
    for (const account of value.accounts) {
      if (typeof account.id !== 'string' || ids.has(account.id) || typeof account.name !== 'string' || !['a', 'b', 'joint'].includes(account.owner) || !Number.isSafeInteger(account.opening)) throw new Error('Compte invalide.');
      date(account.openingDate); date(account.throughDate); if (account.throughDate < account.openingDate) throw new Error('Couverture invalide.'); ids.add(account.id);
    }
    const rowIds = new Set();
    for (const row of value.transactions) {
      if (typeof row.id !== 'string' || rowIds.has(row.id) || !ids.has(row.account) || !Number.isSafeInteger(row.amount) || typeof row.merchant !== 'string' || typeof row.bankLabel !== 'string' || !categories.includes(row.category) || !['income', 'expense', 'transfer', 'settlement'].includes(row.kind) || !['posted', 'pending'].includes(row.status) || !Number.isFinite(row.splitA) || row.splitA < 0 || row.splitA > 100 || typeof row.shared !== 'boolean') throw new Error('Opération invalide.');
      if (row.kind === 'expense' && row.amount > 0 || row.kind === 'income' && row.amount < 0) throw new Error('Sens du montant incohérent.');
      if (row.splitMode !== undefined && !['auto', 'manual'].includes(row.splitMode) || row.recurrence !== undefined && !['auto', 'include', 'exclude'].includes(row.recurrence) || row.recurrenceFrequency !== undefined && !['weekly', 'monthly', 'yearly'].includes(row.recurrenceFrequency)) throw new Error('Annotation invalide.');
      date(row.date); rowIds.add(row.id);
    }
    for (const [category, amount] of Object.entries(value.budgets)) if (!categories.includes(category) || !Number.isSafeInteger(amount) || amount < 0) throw new Error('Budget invalide.');
    if (value.monthlyBudget !== undefined && (!Number.isSafeInteger(value.monthlyBudget) || value.monthlyBudget < 0)) throw new Error('Budget global invalide.');
    if (typeof value.household.a !== 'string' || typeof value.household.b !== 'string' || !Number.isFinite(value.household.ratio) || value.household.ratio < 0 || value.household.ratio > 100) throw new Error('Partage invalide.');
    const recurringIds = new Set();
    for (const item of value.recurring) {
      if (typeof item.id !== 'string' || recurringIds.has(item.id) || !ids.has(item.account) || typeof item.name !== 'string' || !Number.isSafeInteger(item.amount) || item.amount < 0 || !['weekly', 'monthly', 'yearly'].includes(item.frequency) || typeof item.active !== 'boolean' || !categories.includes(item.category)) throw new Error('Récurrent invalide.');
      date(item.nextDate); recurringIds.add(item.id);
    }
    return value;
  }
  function demo() {
    const accounts = [{ id: 'a', name: 'Personnel · Camille', owner: 'a', opening: 180000 }, { id: 'b', name: 'Personnel · Alex', owner: 'b', opening: 140000 }, { id: 'joint', name: 'Compte commun', owner: 'joint', opening: 80000 }].map(account => ({ ...account, openingDate: '2026-03-01', throughDate: '2026-09-30' }));
    const transactions = [];
    function add(month, day, account, merchant, amount, category, shared = false, kind = amount > 0 ? 'income' : 'expense') {
      const rowDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      transactions.push({ id: `demo-${transactions.length}`, date: rowDate, account, merchant, bankLabel: merchant, amount, category, kind, shared, splitA: 60, splitMode: 'auto', status: 'posted', note: '' });
    }
    for (let month = 3; month <= 9; month++) {
      add(month, 1, 'a', 'Salaire · Camille', 285000, 'Revenus'); add(month, 1, 'b', 'Salaire · Alex', 225000, 'Revenus');
      add(month, 3, 'a', 'Loyer', -125000, 'Logement', true); add(month, 4, 'b', 'Électricité', -9200, 'Logement', true);
      add(month, 5, 'a', 'Vers le compte commun', -48000, 'À classer', false, 'transfer'); add(month, 5, 'joint', 'Depuis Camille', 48000, 'À classer', false, 'transfer');
      add(month, 5, 'b', 'Vers le compte commun', -32000, 'À classer', false, 'transfer'); add(month, 5, 'joint', 'Depuis Alex', 32000, 'À classer', false, 'transfer');
      add(month, 8, 'a', 'Spotify', -1099, 'Abonnements'); add(month, 10, 'b', 'Netflix', -1349, 'Abonnements', true); add(month, 12, 'a', 'Internet', -3990, 'Abonnements', true);
      for (let week = 0; week < 4; week++) {
        add(month, 6 + week * 6, 'joint', 'Marché des Halles', -(9300 + month * 190 + week * 310), 'Alimentation', true);
        add(month, 7 + week * 6, 'a', 'Mobilité', -(1400 + month * 70 + week * 90), 'Transport');
        add(month, 9 + week * 5, 'b', 'Restaurant', -(3600 + month * 110 + week * 240), 'Restaurants', true);
        add(month, 11 + week * 4, 'a', 'Vie quotidienne', -(2100 + month * 150 + week * 220), week % 2 ? 'Loisirs' : 'Achats');
      }
      add(month, 26, 'a', 'Mutuelle', -6700, 'Santé'); add(month, 27, 'b', 'Club de sport', -3500, 'Loisirs');
    }
    const recurring = [{ id: 'rent', name: 'Loyer', amount: 125000, account: 'a', category: 'Logement', nextDate: '2026-10-03' }, { id: 'energy', name: 'Électricité', amount: 9200, account: 'b', category: 'Logement', nextDate: '2026-10-04' }, { id: 'spotify', name: 'Spotify', amount: 1099, account: 'a', category: 'Abonnements', nextDate: '2026-10-08' }, { id: 'netflix', name: 'Netflix', amount: 1349, account: 'b', category: 'Abonnements', nextDate: '2026-10-10' }, { id: 'internet', name: 'Internet', amount: 3990, account: 'a', category: 'Abonnements', nextDate: '2026-10-12' }].map(item => ({ ...item, frequency: 'monthly', active: true }));
    return { schema: 1, mode: 'demo', accounts, transactions, recurring, budgets: { Logement: 145000, Alimentation: 60000, Transport: 22000, Restaurants: 24000, Loisirs: 18000, Achats: 18000, Santé: 10000, Abonnements: 10000 }, household: { a: 'Camille', b: 'Alex', ratio: 60 } };
  }
  root.WealthDomain = { categories, iso, date, addDays, shiftMonth, shiftPeriod, range, days, bucket, selectedAccounts, selectedRows, balance, metrics, budgets, budgetSummary, incomeRatio, sharing, detectRecurring, occurrences, parseAmount, csvDate, normalizeRows, fingerprint, reconciliation, validateState, demo };
})(globalThis);