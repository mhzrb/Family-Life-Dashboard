"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createDemoData } from "../lib/demo-data";
import type { DashboardData, Member, Transaction } from "../lib/types";
import {
  budgetMonthKey,
  calculateBudgetStatus,
  monthlyBudgetPlanCents,
} from "../lib/budget";

type Language = "en" | "nl";
type Currency = "EUR" | "USD" | "CAD" | "GBP";
type ExternalData = {
  weather: null | {
    current?: {
      temperature_2m: number;
      apparent_temperature: number;
      weather_code: number;
    };
    daily?: { temperature_2m_max: number[]; temperature_2m_min: number[] };
  };
  place?: { name: string; country_code?: string };
  rates?: Record<string, number>;
};

const displayCurrencies: Currency[] = ["EUR", "USD", "CAD", "GBP"];
const currencySymbols: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  CAD: "C$",
  GBP: "£",
};
const telegramBotUsername = "MZFamilyExpensesTestBot";
const telegramBotUrl = `https://t.me/${telegramBotUsername}`;
const categories = [
  "Groceries",
  "Dining",
  "Transport",
  "Home",
  "Health",
  "Leisure",
  "Bills",
  "Other",
];
const categoryColors: Record<string, string> = {
  Groceries: "#1d6b5a",
  Dining: "#e2764f",
  Transport: "#e6ae3b",
  Home: "#6688c0",
  Health: "#ac78b5",
  Leisure: "#75a87d",
  Bills: "#996853",
  Other: "#a9aaa3",
};
const categoryIcons: Record<string, string> = {
  Groceries: "♧",
  Dining: "☕",
  Transport: "↗",
  Home: "⌂",
  Health: "+",
  Leisure: "✦",
  Bills: "▤",
  Other: "•",
};
const categoryNames: Record<Language, Record<string, string>> = {
  en: {
    Groceries: "Groceries",
    Dining: "Dining",
    Transport: "Transport",
    Home: "Home",
    Health: "Health",
    Leisure: "Leisure",
    Bills: "Bills",
    Other: "Other",
  },
  nl: {
    Groceries: "Boodschappen",
    Dining: "Uit eten",
    Transport: "Vervoer",
    Home: "Wonen",
    Health: "Gezondheid",
    Leisure: "Vrije tijd",
    Bills: "Rekeningen",
    Other: "Overig",
  },
};

const copy: Record<Language, Record<string, string>> = {
  en: {
    overview: "Overview",
    activity: "Activity",
    telegram: "Telegram",
    household: "Household",
    everyone: "Everyone",
    combined: "Combined view",
    you: "You",
    member: "Member",
    invite: "Invite family member",
    telegramBot: "Telegram bot",
    officialBot: "Official family bot",
    openOfficialBot: "Open @MZFamilyExpensesTestBot",
    exitTest: "Exit test mode",
    trySample: "Try sample data",
    greeting: "Good afternoon, family.",
    hello: "Hello",
    subtitle: "Here’s how life at home is looking.",
    testDrive: "Test drive",
    test: "Test",
    live: "Live",
    sampleData: "sample data",
    justNow: "just now",
    syncing: "syncing",
    testMode: "Test mode",
    testMessage:
      "These sample entries are temporary. Add expenses, switch members and explore every chart.",
    spentMonth: "Spent this month",
    freshMonth: "A fresh month",
    fromLastMonth: "from last month",
    dailyAverage: "Daily average",
    across: "across",
    people: "people",
    thisMember: "this member",
    topCategory: "Top category",
    nothingYet: "Nothing yet",
    firstEntry: "Your first entry will appear here",
    last8: "Last 8 weeks",
    rhythm: "Spending rhythm",
    selectedMember: "Selected member",
    weeksAgo8: "8 weeks ago",
    weeks6: "6 weeks",
    weeks4: "4 weeks",
    weeks2: "2 weeks",
    thisWeek: "This week",
    allActivity: "All activity",
    byCategory: "By category",
    latest: "Latest",
    recent: "Recent activity",
    viewAll: "View all",
    bot: "Bot",
    emptyTitle: "Your story starts here",
    emptyText: "Add the first expense and this space will come alive.",
    rates: "Rates",
    oneEuro: "€1",
    total: "Total",
    refreshed: "Reference rates · refreshed automatically",
    familySpace: "Your family space",
    readyGrow: "Ready to grow with you.",
    future:
      "Budgets, reminders, shared events and smarter inputs can be added whenever your household needs them.",
    addExpense: "Add expense",
    displayCurrency: "Display currency",
    language: "Language",
    newEntry: "New entry",
    amount: "Amount",
    category: "Category",
    whatFor: "What was it for?",
    example: "e.g. Weekly groceries",
    cancel: "Cancel",
    saving: "Saving…",
    householdLedger: "Household ledger",
    close: "Close",
    entered: "entered",
    yourHousehold: "Your household",
    inviteTitle: "Invite a family member",
    inviteHelp:
      "Their sign-in email connects them to this shared household while keeping their personal view separate.",
    name: "Name",
    email: "Email",
    adding: "Adding…",
    addHousehold: "Add to household",
    manageMembers: "Manage members",
    memberChanges: "Member changes",
    activeMembers: "Active members",
    joined: "Joined",
    notJoined: "Invited · not signed in yet",
    lastSeen: "Last seen",
    allMonths: "All months",
    today: "Today",
    yesterday: "Yesterday",
    selectedDay: "Selected day",
    previousDay: "Previous day",
    nextDay: "Next day",
    backToToday: "Back to today",
    dailyExpenses: "Expenses on this day",
    noExpensesOnDay: "No expenses were recorded on this day.",
    pendingChanges: "Pending approvals",
    noPending: "No changes are waiting for approval.",
    remove: "Remove",
    removing: "Requesting…",
    approve: "Approve",
    approving: "Approving…",
    approvedByYou: "Approved by you",
    requestedBy: "Requested by",
    addRequest: "Add member",
    removeRequest: "Remove member",
    approvals: "approvals",
    approvalHelp:
      "Adding needs approval from the existing household. Removing needs every remaining member to approve.",
    requestSubmitted: "Request submitted",
    addAnother: "Invite member",
    nameMustBeUnique: "Each active member needs a unique name.",
    copyTelegram: "Copy Telegram link",
    copiedTelegram: "Link copied",
    fastCapture: "Fast capture",
    logTelegram: "Log from Telegram",
    connected: "Permanent secure Telegram delivery is active.",
    notConnected:
      "This workflow is available after the family bot is connected.",
    openBot:
      "Generate a private one-time link, then send it to the family bot within 24 hours.",
    logLine:
      "Then tap Add expense, choose a category and send only the amount:",
    copied: "Copied",
    copy: "Generate & copy",
    botAuto:
      "Telegram entries arrive automatically, even when the dashboard is closed.",
    botPreview: "Permanent Telegram delivery still needs to be enabled.",
    activateBot: "Enable permanent delivery",
    activatingBot: "Enabling…",
    secretsMissing: "Telegram secrets still need to be added on the host.",
    ownerActivates: "The household owner needs to enable Telegram delivery.",
    syncNow: "Sync now",
    syncingTelegram: "Syncing…",
    clear: "Clear",
    cloudy: "Partly cloudy",
    rain: "Rain",
    snow: "Snow",
    showers: "Showers",
    feels: "Feels like",
    high: "H",
    low: "L",
  },
  nl: {
    overview: "Overzicht",
    activity: "Activiteit",
    telegram: "Telegram",
    household: "Huishouden",
    everyone: "Iedereen",
    combined: "Gezamenlijk overzicht",
    you: "Jij",
    member: "Lid",
    invite: "Gezinslid uitnodigen",
    telegramBot: "Telegram-bot",
    officialBot: "Officiële gezinsbot",
    openOfficialBot: "Open @MZFamilyExpensesTestBot",
    exitTest: "Testmodus afsluiten",
    trySample: "Voorbeeldgegevens",
    greeting: "Goedemiddag, familie.",
    hello: "Hallo",
    subtitle: "Zo ziet het leven thuis er vandaag uit.",
    testDrive: "Testen",
    test: "Test",
    live: "Live",
    sampleData: "voorbeeldgegevens",
    justNow: "zojuist",
    syncing: "synchroniseren",
    testMode: "Testmodus",
    testMessage:
      "Deze voorbeeldgegevens zijn tijdelijk. Voeg uitgaven toe, wissel van gezinslid en bekijk alle grafieken.",
    spentMonth: "Uitgegeven deze maand",
    freshMonth: "Een nieuwe maand",
    fromLastMonth: "ten opzichte van vorige maand",
    dailyAverage: "Dagelijks gemiddelde",
    across: "verdeeld over",
    people: "personen",
    thisMember: "dit gezinslid",
    topCategory: "Grootste categorie",
    nothingYet: "Nog niets",
    firstEntry: "Je eerste uitgave verschijnt hier",
    last8: "Laatste 8 weken",
    rhythm: "Uitgavenritme",
    selectedMember: "Geselecteerd gezinslid",
    weeksAgo8: "8 weken geleden",
    weeks6: "6 weken",
    weeks4: "4 weken",
    weeks2: "2 weken",
    thisWeek: "Deze week",
    allActivity: "Alle activiteit",
    byCategory: "Per categorie",
    latest: "Recent",
    recent: "Recente activiteit",
    viewAll: "Alles bekijken",
    bot: "Bot",
    emptyTitle: "Je verhaal begint hier",
    emptyText: "Voeg de eerste uitgave toe en dit overzicht komt tot leven.",
    rates: "Koersen",
    oneEuro: "€1",
    total: "Totaal",
    refreshed: "Referentiekoersen · automatisch vernieuwd",
    familySpace: "Jullie gezinsruimte",
    readyGrow: "Klaar om mee te groeien.",
    future:
      "Budgetten, herinneringen, gedeelde afspraken en slimmere invoer kunnen later worden toegevoegd.",
    addExpense: "Uitgave toevoegen",
    displayCurrency: "Weergavevaluta",
    language: "Taal",
    newEntry: "Nieuwe invoer",
    amount: "Bedrag",
    category: "Categorie",
    whatFor: "Waar was het voor?",
    example: "bijv. Weekboodschappen",
    cancel: "Annuleren",
    saving: "Opslaan…",
    householdLedger: "Huishoudboek",
    close: "Sluiten",
    entered: "ingevoerd",
    yourHousehold: "Jouw huishouden",
    inviteTitle: "Gezinslid uitnodigen",
    inviteHelp:
      "Het e-mailadres waarmee diegene inlogt wordt aan dit huishouden gekoppeld, met een eigen persoonlijk overzicht.",
    name: "Naam",
    email: "E-mail",
    adding: "Toevoegen…",
    addHousehold: "Toevoegen aan huishouden",
    manageMembers: "Leden beheren",
    memberChanges: "Wijzigingen in leden",
    activeMembers: "Actieve leden",
    joined: "Aangemeld",
    notJoined: "Uitgenodigd · nog niet ingelogd",
    lastSeen: "Laatst gezien",
    allMonths: "Alle maanden",
    today: "Vandaag",
    yesterday: "Gisteren",
    selectedDay: "Geselecteerde dag",
    previousDay: "Vorige dag",
    nextDay: "Volgende dag",
    backToToday: "Terug naar vandaag",
    dailyExpenses: "Uitgaven op deze dag",
    noExpensesOnDay: "Op deze dag zijn geen uitgaven geregistreerd.",
    pendingChanges: "Wacht op goedkeuring",
    noPending: "Er wachten geen wijzigingen op goedkeuring.",
    remove: "Verwijderen",
    removing: "Aanvragen…",
    approve: "Goedkeuren",
    approving: "Goedkeuren…",
    approvedByYou: "Door jou goedgekeurd",
    requestedBy: "Aangevraagd door",
    addRequest: "Lid toevoegen",
    removeRequest: "Lid verwijderen",
    approvals: "goedkeuringen",
    approvalHelp:
      "Toevoegen vereist goedkeuring van het bestaande huishouden. Verwijderen vereist goedkeuring van alle overblijvende leden.",
    requestSubmitted: "Aanvraag ingediend",
    addAnother: "Lid uitnodigen",
    nameMustBeUnique: "Elk actief lid moet een unieke naam hebben.",
    copyTelegram: "Telegram-link kopiëren",
    copiedTelegram: "Link gekopieerd",
    fastCapture: "Snel invoeren",
    logTelegram: "Invoeren via Telegram",
    connected: "Permanente beveiligde Telegram-bezorging is actief.",
    notConnected:
      "Deze functie is beschikbaar nadat de gezinsbot is gekoppeld.",
    openBot:
      "Maak een persoonlijke eenmalige link en stuur die binnen 24 uur naar de gezinsbot.",
    logLine:
      "Tik daarna op Uitgave toevoegen, kies een categorie en stuur alleen het bedrag:",
    copied: "Gekopieerd",
    copy: "Maken en kopiëren",
    botAuto:
      "Telegram-uitgaven komen automatisch binnen, ook als het dashboard gesloten is.",
    botPreview: "Permanente Telegram-bezorging moet nog worden ingeschakeld.",
    activateBot: "Permanente bezorging inschakelen",
    activatingBot: "Inschakelen…",
    secretsMissing:
      "De Telegram-secrets moeten nog op de host worden ingesteld.",
    ownerActivates:
      "De eigenaar van het huishouden moet Telegram-bezorging inschakelen.",
    syncNow: "Nu synchroniseren",
    syncingTelegram: "Synchroniseren…",
    clear: "Helder",
    cloudy: "Halfbewolkt",
    rain: "Regen",
    snow: "Sneeuw",
    showers: "Buien",
    feels: "Voelt als",
    high: "H",
    low: "L",
  },
};

function clientId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}
async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    /* Fall through for browsers that block the Clipboard API. */
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function categoryLabel(language: Language, category: string) {
  return categoryNames[language][category] ?? category;
}
function categoryColor(category: string) {
  return categoryColors[category] ?? "#71877f";
}
function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}
function expenseDayKey(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function dateFromDayKey(key: string) {
  return new Date(`${key}T12:00:00Z`);
}
function shiftDayKey(key: string, offset: number) {
  const value = dateFromDayKey(key);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
function readableDay(key: string, language: Language) {
  return dateFromDayKey(key).toLocaleDateString(
    language === "nl" ? "nl-NL" : "en-GB",
    {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
}
function monthFromKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month, 1);
}
function monthLabel(key: string, language: Language) {
  return monthFromKey(key).toLocaleDateString(
    language === "nl" ? "nl-NL" : "en-GB",
    { month: "long", year: "numeric" },
  );
}
function convertedCents(
  baseCents: number,
  currency: Currency,
  rates?: Record<string, number>,
) {
  return Math.round(
    baseCents * (currency === "EUR" ? 1 : (rates?.[currency] ?? 1)),
  );
}
function ratesFromBase(
  eurRates: Record<string, number> | undefined,
  baseCurrency: Currency,
) {
  if (!eurRates) return undefined;
  const eurValue = (currency: Currency) =>
    currency === "EUR" ? 1 : (eurRates[currency] ?? 1);
  const base = eurValue(baseCurrency);
  return Object.fromEntries(
    displayCurrencies.map((currency) => [currency, eurValue(currency) / base]),
  );
}
function money(
  baseCents: number,
  currency: Currency,
  rates: Record<string, number> | undefined,
  language: Language,
  digits = 0,
) {
  return new Intl.NumberFormat(language === "nl" ? "nl-NL" : "en-NL", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(convertedCents(baseCents, currency, rates) / 100);
}
function weatherLabel(code: number | undefined, language: Language) {
  const t = copy[language];
  if (!code) return { icon: "☀", label: t.clear };
  if (code <= 3) return { icon: "☁", label: t.cloudy };
  if (code <= 67) return { icon: "☂", label: t.rain };
  if (code <= 77) return { icon: "❄", label: t.snow };
  return { icon: "ϟ", label: t.showers };
}

function ExpenseCalendar({
  selectedDay,
  expenseDays,
  language,
  onSelect,
  onClose,
}: {
  selectedDay: string;
  expenseDays: Set<string>;
  language: Language;
  onSelect: (day: string) => void;
  onClose: () => void;
}) {
  const [viewMonth, setViewMonth] = useState(selectedDay.slice(0, 7));
  const todayKey = expenseDayKey(new Date());
  const [year, month] = viewMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const mondayOffset = (firstWeekday + 6) % 7;
  const cells: Array<number | null> = [
    ...Array.from({ length: mondayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const weekdays =
    language === "nl"
      ? ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"]
      : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  function moveMonth(offset: number) {
    const value = new Date(Date.UTC(year, month - 1 + offset, 1));
    setViewMonth(
      `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  return (
    <div className="expense-calendar" role="dialog" aria-label={language === "nl" ? "Kies een dag" : "Choose a day"}>
      <div className="calendar-head">
        <button type="button" onClick={() => moveMonth(-1)} aria-label={language === "nl" ? "Vorige maand" : "Previous month"}>‹</button>
        <strong>
          {dateFromDayKey(`${viewMonth}-01`).toLocaleDateString(
            language === "nl" ? "nl-NL" : "en-GB",
            { timeZone: "UTC", month: "long", year: "numeric" },
          )}
        </strong>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          disabled={viewMonth >= todayKey.slice(0, 7)}
          aria-label={language === "nl" ? "Volgende maand" : "Next month"}
        >›</button>
      </div>
      <div className="calendar-grid calendar-weekdays">
        {weekdays.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid">
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const key = `${viewMonth}-${String(day).padStart(2, "0")}`;
          const future = key > todayKey;
          return (
            <button
              type="button"
              key={key}
              className={`${key === selectedDay ? "selected" : ""} ${expenseDays.has(key) ? "has-expense" : ""}`}
              disabled={future}
              onClick={() => onSelect(key)}
              aria-label={readableDay(key, language)}
            >
              {day}
              {expenseDays.has(key) && <i />}
            </button>
          );
        })}
      </div>
      <button type="button" className="calendar-close" onClick={onClose}>
        {language === "nl" ? "Sluiten" : "Close"}
      </button>
    </div>
  );
}

function Modal({
  title,
  eyebrow,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={closeLabel}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function AddExpenseModal({
  data,
  language,
  rates,
  demoMode,
  onClose,
  onSaved,
}: {
  data: DashboardData;
  language: Language;
  rates?: Record<string, number>;
  demoMode: boolean;
  onClose: () => void;
  onSaved: (item: Transaction) => void;
}) {
  const t = copy[language];
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(
    data.household.baseCurrency as Currency,
  );
  const [category, setCategory] = useState("Groceries");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const numericAmount = Number(amount);
    const baseRate =
      currency === data.household.baseCurrency
        ? 1
        : 1 / (rates?.[currency] ?? 1);
    const draft: Transaction = {
      id: clientId(),
      memberId: data.currentMemberId,
      amountCents: Math.round(numericAmount * 100),
      baseAmountCents: Math.round(numericAmount * baseRate * 100),
      currency,
      category,
      note: note || categoryLabel(language, category),
      type: "expense",
      source: "web",
      happenedAt: new Date().toISOString(),
    };
    if (demoMode) {
      onSaved(draft);
      onClose();
      return;
    }
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "addTransaction",
          amount,
          category,
          note,
          currency,
          baseRate,
        }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json<{ error?: string }>()).error || "Could not save",
        );
      onSaved(
        ((await response.json()) as { transaction: Transaction }).transaction,
      );
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save",
      );
    } finally {
      setSaving(false);
    }
  }

  const availableCategories = [
    ...categories,
    ...data.categories.map((item) => item.name),
  ];
  return (
    <Modal
      eyebrow={t.newEntry}
      title={t.addExpense}
      closeLabel={t.close}
      onClose={onClose}
    >
      <form onSubmit={submit} className="expense-form">
        <label className="amount-field">
          <span>{t.amount}</span>
          <div>
            <b>{currencySymbols[currency]}</b>
            <input
              autoFocus
              inputMode="decimal"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <select
              className="currency-select"
              aria-label={t.displayCurrency}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {displayCurrencies.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </label>
        <label>
          <span>{t.category}</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {availableCategories.map((item) => (
              <option key={item} value={item}>
                {categoryLabel(language, item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t.whatFor}</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.example}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="entry-owner">
          <span
            className="avatar"
            style={{
              background: data.members.find(
                (m) => m.id === data.currentMemberId,
              )?.color,
            }}
          >
            {initials(
              data.members.find((m) => m.id === data.currentMemberId)?.name ??
                "Me",
            )}
          </span>
          <span>
            {data.members.find((m) => m.id === data.currentMemberId)?.name}
          </span>
        </div>
        <div className="modal-actions">
          <button type="button" className="text-button" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? t.saving : t.addExpense}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function InviteModal({
  language,
  data,
  demoMode,
  onClose,
  onUpdated,
}: {
  language: Language;
  data: DashboardData;
  demoMode: boolean;
  onClose: () => void;
  onUpdated: (data: DashboardData) => void;
}) {
  const t = copy[language];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const normalized = name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    if (
      data.members.some(
        (member) =>
          member.status === "active" &&
          member.name.trim().replace(/\s+/g, " ").toLocaleLowerCase() ===
            normalized,
      )
    ) {
      setError(t.nameMustBeUnique);
      setSaving(false);
      return;
    }
    if (demoMode) {
      onUpdated({
        ...data,
        members: [
          ...data.members,
          {
            id: clientId(),
            name: name.trim(),
            email: email.trim().toLowerCase(),
            color: "#8b6ccf",
            role: "member",
            canViewHousehold: false,
            status: "active",
            telegramLinkCode: "TEST12",
          },
        ],
      });
      onClose();
      setSaving(false);
      return;
    }
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "requestAddMember", name, email }),
      });
      const result = (await response.json()) as DashboardData & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Could not request a new member");
      onUpdated(result);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not request a new member",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      eyebrow={t.yourHousehold}
      title={t.inviteTitle}
      closeLabel={t.close}
      onClose={onClose}
    >
      <p className="modal-copy">
        {t.inviteHelp} {t.nameMustBeUnique}
      </p>
      <form onSubmit={submit} className="expense-form">
        <div className="form-grid">
          <label>
            <span>{t.name}</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mohammad"
            />
          </label>
          <label>
            <span>{t.email}</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
            />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="text-button" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? t.adding : t.addHousehold}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditExpenseModal({
  item,
  data,
  language,
  demoMode,
  onClose,
  onUpdated,
  onDeleted,
}: {
  item: Transaction;
  data: DashboardData;
  language: Language;
  demoMode: boolean;
  onClose: () => void;
  onUpdated: (item: Transaction) => void;
  onDeleted: (id: string) => void;
}) {
  const t = copy[language];
  const [amount, setAmount] = useState((item.amountCents / 100).toFixed(2));
  const [category, setCategory] = useState(item.category);
  const [note, setNote] = useState(item.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currentMember = data.members.find(
    (member) => member.id === data.currentMemberId,
  );
  const canEdit = item.memberId === data.currentMemberId;
  const canDelete = canEdit || currentMember?.role === "owner";
  const availableCategories = [
    ...categories,
    ...data.categories.map((entry) => entry.name),
  ];
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setError("");
    if (demoMode) {
      onUpdated({
        ...item,
        amountCents: Math.round(Number(amount) * 100),
        baseAmountCents: Math.round(Number(amount) * 100),
        category,
        note: note || category,
      });
      onClose();
      return;
    }
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "updateTransaction",
          transactionId: item.id,
          amount,
          category,
          note,
        }),
      });
      const result = (await response.json()) as {
        transaction?: Transaction;
        error?: string;
      };
      if (!response.ok || !result.transaction)
        throw new Error(result.error || "Could not update expense");
      onUpdated(result.transaction);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update expense");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !window.confirm(
        language === "nl"
          ? "Deze uitgave verwijderen?"
          : "Delete this expense?",
      )
    )
      return;
    setBusy(true);
    setError("");
    if (demoMode) {
      onDeleted(item.id);
      onClose();
      return;
    }
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "deleteTransaction",
          transactionId: item.id,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || "Could not delete expense");
      onDeleted(item.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete expense");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      eyebrow={t.householdLedger}
      title={
        canEdit
          ? language === "nl"
            ? "Uitgave bewerken"
            : "Edit expense"
          : language === "nl"
            ? "Uitgave beheren"
            : "Manage expense"
      }
      closeLabel={t.close}
      onClose={onClose}
    >
      <form className="expense-form" onSubmit={save}>
        <label className="amount-field">
          <span>
            {t.amount} · {item.currency}
          </span>
          <div>
            <b>{currencySymbols[item.currency as Currency] ?? item.currency}</b>
            <input
              autoFocus
              disabled={!canEdit}
              inputMode="decimal"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </label>
        <label>
          <span>{t.category}</span>
          <select
            disabled={!canEdit}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {availableCategories.map((entry) => (
              <option key={entry}>{categoryLabel(language, entry)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t.whatFor}</span>
          <input
            disabled={!canEdit}
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions split-actions">
          {canDelete && (
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={remove}
            >
              {language === "nl" ? "Verwijderen" : "Delete"}
            </button>
          )}
          <span />
          <button type="button" className="text-button" onClick={onClose}>
            {t.cancel}
          </button>
          {canEdit && (
            <button className="primary-button" disabled={busy}>
              {busy
                ? t.saving
                : language === "nl"
                  ? "Opslaan"
                  : "Save changes"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function SettingsModal({
  data,
  language,
  demoMode,
  onClose,
  onUpdated,
}: {
  data: DashboardData;
  language: Language;
  demoMode: boolean;
  onClose: () => void;
  onUpdated: (data: DashboardData) => void;
}) {
  const t = copy[language];
  const current = data.members.find(
    (member) => member.id === data.currentMemberId,
  );
  const [profileName, setProfileName] = useState(current?.name ?? "");
  const [categoryName, setCategoryName] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function updateProfile(event: FormEvent) {
    event.preventDefault();
    setBusy("profile");
    setError("");
    if (demoMode) {
      onUpdated({
        ...data,
        members: data.members.map((member) =>
          member.id === data.currentMemberId
            ? { ...member, name: profileName.trim() }
            : member,
        ),
      });
      setBusy("");
      return;
    }
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "updateProfileName",
          name: profileName,
        }),
      });
      const result = (await response.json()) as DashboardData & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Could not change your name");
      onUpdated(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not change your name",
      );
    } finally {
      setBusy("");
    }
  }
  async function categoryAction(
    action: "addCategory" | "archiveCategory",
    value: string,
  ) {
    setBusy(value);
    setError("");
    if (demoMode) {
      onUpdated(
        action === "addCategory"
          ? {
              ...data,
              categories: [...data.categories, { id: clientId(), name: value }],
            }
          : {
              ...data,
              categories: data.categories.filter((item) => item.id !== value),
            },
      );
      setCategoryName("");
      setBusy("");
      return;
    }
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "addCategory"
            ? { action, name: value }
            : { action, categoryId: value },
        ),
      });
      const result = (await response.json()) as DashboardData & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Could not update categories");
      onUpdated(result);
      setCategoryName("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update categories",
      );
    } finally {
      setBusy("");
    }
  }
  async function resetTransactions() {
    const warning =
      language === "nl"
        ? "Download eerst een JSON-back-up als je deze uitgaven wilt bewaren. Alle huidige huishoudelijke uitgaven worden uit het dashboard verwijderd. Doorgaan?"
        : "Download a JSON backup first if you want to keep these expenses. Only your own expenses will be removed. Continue?";
    if (!window.confirm(warning)) return;
    setBusy("reset");
    setError("");
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "resetTransactions",
          confirmation: "RESET",
        }),
      });
      const result = (await response.json()) as DashboardData & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Could not reset expenses");
      onUpdated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset expenses");
    } finally {
      setBusy("");
    }
  }
  return (
    <Modal
      eyebrow={language === "nl" ? "PROFIEL" : "PROFILE"}
      title={language === "nl" ? "Mijn instellingen" : "My settings"}
      closeLabel={t.close}
      onClose={onClose}
    >
      <div className="settings-grid">
        <section className="settings-section">
          <h3>{language === "nl" ? "Mijn naam" : "My name"}</h3>
          <p>
            {language === "nl"
              ? "Alleen jij kunt je weergavenaam wijzigen."
              : "Only you can change your display name."}
          </p>
          <form className="category-create" onSubmit={updateProfile}>
            <input
              minLength={2}
              maxLength={80}
              required
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              placeholder="Mohammad"
            />
            <button className="primary-button compact" disabled={Boolean(busy)}>
              {busy === "profile"
                ? language === "nl"
                  ? "Opslaan…"
                  : "Saving…"
                : language === "nl"
                  ? "Naam opslaan"
                  : "Save name"}
            </button>
          </form>
        </section>
        <section className="settings-section">
          <h3>
            {language === "nl" ? "Eigen categorieën" : "Custom categories"}
          </h3>
          <p>
            {language === "nl"
              ? "Deze categorieën verschijnen op de website en in Telegram."
              : "These categories appear on the website and in Telegram."}
          </p>
          <form
            className="category-create"
            onSubmit={(event) => {
              event.preventDefault();
              if (categoryName.trim())
                categoryAction("addCategory", categoryName.trim());
            }}
          >
            <input
              minLength={2}
              maxLength={30}
              required
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder={language === "nl" ? "bijv. Huisdieren" : "e.g. Pets"}
            />
            <button className="primary-button compact" disabled={Boolean(busy)}>
              ＋ {language === "nl" ? "Toevoegen" : "Add"}
            </button>
          </form>
          <div className="category-manager">
            {data.categories.length ? (
              data.categories.map((item) => (
                <div key={item.id}>
                  <span style={{ background: categoryColor(item.name) }}>
                    •
                  </span>
                  <b>{item.name}</b>
                  <button
                    className="danger-button"
                    disabled={busy === item.id}
                    onClick={() => categoryAction("archiveCategory", item.id)}
                  >
                    {language === "nl" ? "Archiveren" : "Archive"}
                  </button>
                </div>
              ))
            ) : (
              <p>
                {language === "nl"
                  ? "Nog geen eigen categorieën."
                  : "No custom categories yet."}
              </p>
            )}
          </div>
        </section>
        <section className="settings-section">
          <h3>
            {language === "nl"
              ? "Mijn export en back-up"
              : "My export & backup"}
          </h3>
          <p>
            {language === "nl"
              ? "Download alleen je eigen uitgaven."
              : "Download only your own expenses."}
          </p>
          <div className="export-actions">
            <a className="primary-button" href="/api/export?format=csv">
              CSV
            </a>
            <a
              className="text-button export-link"
              href="/api/export?format=json"
            >
              JSON backup
            </a>
          </div>
        </section>
        <section className="settings-section danger-zone">
          <h3>{language === "nl" ? "Mijn nieuwe start" : "My fresh start"}</h3>
          <p>
            {language === "nl"
              ? "Verwijder alleen je eigen huidige uitgaven."
              : "Remove only your own current expenses."}
          </p>
          <button
            className="danger-button reset-button"
            disabled={busy === "reset" || demoMode}
            onClick={resetTransactions}
          >
            {busy === "reset"
              ? language === "nl"
                ? "Resetten…"
                : "Resetting…"
              : language === "nl"
                ? "Mijn uitgaven resetten"
                : "Reset my expenses"}
          </button>
        </section>
        <section className="settings-section audit-section">
          <h3>
            {language === "nl"
              ? "Mijn recente beveiligingsactiviteit"
              : "My recent security activity"}
          </h3>
          <div className="audit-list">
            {data.auditLogs.length ? (
              data.auditLogs.map((item) => (
                <div key={item.id}>
                  <span>✓</span>
                  <p>
                    <b>{item.summary}</b>
                    <small>
                      {new Date(item.createdAt).toLocaleString(
                        language === "nl" ? "nl-NL" : "en-GB",
                      )}
                    </small>
                  </p>
                </div>
              ))
            ) : (
              <p>
                {language === "nl"
                  ? "Nog geen activiteit."
                  : "No activity recorded yet."}
              </p>
            )}
          </div>
        </section>
      </div>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}

function MemberManagementModal({
  language,
  data,
  demoMode,
  onClose,
  onInvite,
  onUpdated,
}: {
  language: Language;
  data: DashboardData;
  demoMode: boolean;
  onClose: () => void;
  onInvite: () => void;
  onUpdated: (data: DashboardData) => void;
}) {
  const t = copy[language];
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const active = data.members.filter((member) => member.status === "active");
  const owner =
    data.members.find((member) => member.id === data.currentMemberId)?.role ===
    "owner";
  async function removeMember(id: string) {
    setBusy(id);
    setError("");
    if (demoMode) {
      onUpdated({
        ...data,
        members: data.members.map((member) =>
          member.id === id ? { ...member, status: "removed" as const } : member,
        ),
      });
      setBusy("");
      return;
    }
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "requestRemoveMember",
          targetMemberId: id,
        }),
      });
      const result = (await response.json()) as DashboardData & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Could not update members");
      onUpdated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update members");
    } finally {
      setBusy("");
    }
  }
  async function setHouseholdVisibility(id: string, allowed: boolean) {
    const busyKey = `access:${id}`;
    setBusy(busyKey);
    setError("");
    if (demoMode) {
      onUpdated({
        ...data,
        members: data.members.map((member) =>
          member.id === id
            ? { ...member, canViewHousehold: allowed }
            : member,
        ),
      });
      setBusy("");
      return;
    }
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "setHouseholdVisibility",
          targetMemberId: id,
          allowed,
        }),
      });
      const result = (await response.json()) as DashboardData & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Could not update viewing access");
      onUpdated(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update viewing access",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <Modal
      eyebrow={t.yourHousehold}
      title={t.manageMembers}
      closeLabel={t.close}
      onClose={onClose}
    >
      {!owner ? (
        <p className="form-error">
          {language === "nl"
            ? "Alleen de eigenaar kan leden beheren."
            : "Only the owner can manage members."}
        </p>
      ) : (
        <>
          <p className="modal-copy">
            {language === "nl"
              ? "De eigenaar kan leden toevoegen of verwijderen en bepalen wie het gezamenlijke overzicht mag zien."
              : "The owner can add or remove members and decide who may see the combined household overview."}
          </p>
          <div className="member-section">
            <div className="member-section-head">
              <span>
                {t.activeMembers} · {active.length}
              </span>
              <button className="text-button compact" onClick={onInvite}>
                ＋ {t.addAnother}
              </button>
            </div>
            {active.map((member) => (
              <div className="member-row" key={member.id}>
                <span className="avatar" style={{ background: member.color }}>
                  {initials(member.name)}
                </span>
                <div>
                  <b>{member.name}</b>
                  <small>
                    {member.id === data.currentMemberId
                      ? language === "nl"
                        ? "Eigenaar · jij"
                        : "Owner · you"
                      : member.joinedAt
                        ? `${t.member} · ${t.joined}`
                        : t.notJoined}
                  </small>
                  {member.lastSeenAt && (
                    <small className="member-presence">
                      {t.lastSeen}: {new Date(member.lastSeenAt).toLocaleString(
                        language === "nl" ? "nl-NL" : "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </small>
                  )}
                </div>
                <div className="member-row-actions">
                  {member.id !== data.currentMemberId && (
                    <>
                      <button
                        className={`access-toggle ${member.canViewHousehold ? "enabled" : ""}`}
                        disabled={busy === `access:${member.id}`}
                        onClick={() =>
                          setHouseholdVisibility(
                            member.id,
                            !member.canViewHousehold,
                          )
                        }
                      >
                        {busy === `access:${member.id}`
                          ? language === "nl"
                            ? "Opslaan…"
                            : "Saving…"
                          : member.canViewHousehold
                            ? language === "nl"
                              ? "Everyone: aan"
                              : "Everyone: on"
                            : language === "nl"
                              ? "Everyone: uit"
                              : "Everyone: off"}
                      </button>
                      <button
                        className="danger-button"
                        disabled={busy === member.id}
                        onClick={() => removeMember(member.id)}
                      >
                        {busy === member.id
                          ? language === "nl"
                            ? "Verwijderen…"
                            : "Removing…"
                          : t.remove}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}

function TelegramPanel({
  current,
  configured,
  ready,
  language,
  onActivated,
  onUpdated,
}: {
  current: Member;
  configured: boolean;
  ready: boolean;
  language: Language;
  onActivated: () => void;
  onUpdated: (data: DashboardData) => void;
}) {
  const t = copy[language];
  const [copied, setCopied] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  async function copyCode() {
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "rotateTelegramLink",
          targetMemberId: current.id,
        }),
      });
      const result = (await response.json()) as DashboardData & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Could not create Telegram link");
      onUpdated(result);
      const next = result.members.find(
        (item) => item.id === current.id,
      )?.telegramLinkCode;
      if (!next) throw new Error("Could not create Telegram link");
      await copyText(`/link ${next}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create Telegram link",
      );
    }
  }
  async function activate() {
    setActivating(true);
    setError("");
    try {
      const response = await fetch("/api/telegram/setup", { method: "POST" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || "Could not activate Telegram");
      onActivated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not activate Telegram",
      );
    } finally {
      setActivating(false);
    }
  }
  return (
    <div className="telegram-panel">
      <div className="telegram-mark">↗</div>
      <div>
        <span className="eyebrow">{t.fastCapture}</span>
        <h3>{t.logTelegram}</h3>
        <p>
          {ready ? t.connected : configured ? t.botPreview : t.secretsMissing}
        </p>
        <a
          className="telegram-bot-link"
          href={telegramBotUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={t.officialBot}
        >
          ↗ {t.openOfficialBot}
        </a>
        {configured && !ready && current.role === "owner" && (
          <button
            className="activate-bot"
            disabled={activating}
            onClick={activate}
          >
            {activating ? t.activatingBot : t.activateBot}
          </button>
        )}
        {configured && !ready && current.role !== "owner" && (
          <p className="tiny-note">{t.ownerActivates}</p>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
      <div className="telegram-steps">
        <span>1</span>
        <p>{t.openBot}</p>
        <button onClick={copyCode} className="code-pill">
          <code>/link ••••••••</code>
          <b>{copied ? t.copied : t.copy}</b>
        </button>
        <span>2</span>
        <p>{t.logLine}</p>
        <div className="message-example">24.50</div>
      </div>
      <p className="tiny-note">{ready ? t.botAuto : t.botPreview}</p>
    </div>
  );
}

function ActivityModal({
  items,
  members,
  currentMemberId,
  isOwner,
  language,
  displayCurrency,
  baseCurrency,
  rates,
  onClose,
  onEdit,
}: {
  items: Transaction[];
  members: Member[];
  currentMemberId: string;
  isOwner: boolean;
  language: Language;
  displayCurrency: Currency;
  baseCurrency: Currency;
  rates?: Record<string, number>;
  onClose: () => void;
  onEdit: (item: Transaction) => void;
}) {
  const t = copy[language];
  const [selectedMonth, setSelectedMonth] = useState("all");
  const sortedItems = [...items].sort(
    (a, b) =>
      new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime(),
  );
  const monthKeys = Array.from(
    new Set(
      sortedItems.map((item) => {
        return expenseDayKey(item.happenedAt).slice(0, 7);
      }),
    ),
  );
  const filteredItems = sortedItems.filter((item) => {
    if (selectedMonth === "all") return true;
    return expenseDayKey(item.happenedAt).slice(0, 7) === selectedMonth;
  });
  const groups = Array.from(
    filteredItems.reduce((grouped, item) => {
      const key = expenseDayKey(item.happenedAt);
      const current = grouped.get(key) ?? [];
      current.push(item);
      grouped.set(key, current);
      return grouped;
    }, new Map<string, Transaction[]>()),
  );
  const today = expenseDayKey(new Date());
  const yesterday = shiftDayKey(today, -1);
  const dayLabel = (key: string) => {
    if (key === today) return t.today;
    if (key === yesterday) return t.yesterday;
    return readableDay(key, language);
  };
  return (
    <Modal
      eyebrow={t.householdLedger}
      title={t.allActivity}
      closeLabel={t.close}
      onClose={onClose}
    >
      <div className="activity-history-toolbar">
        <p>
          {language === "nl"
            ? `${filteredItems.length} uitgaven in deze geschiedenis`
            : `${filteredItems.length} expenses in this history`}
        </p>
        <select
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          aria-label={t.allMonths}
        >
          <option value="all">{t.allMonths}</option>
          {monthKeys.map((key) => (
            <option value={key} key={key}>
              {new Date(`${key}-01T12:00:00`).toLocaleDateString(
                language === "nl" ? "nl-NL" : "en-GB",
                { month: "long", year: "numeric" },
              )}
            </option>
          ))}
        </select>
      </div>
      <div className="all-activity-list">
        {groups.map(([day, dayItems]) => (
          <section className="activity-day" key={day}>
            <div className="activity-day-head">
              <div>
                <b>{dayLabel(day)}</b>
                <span>
                  {dayItems.length} {language === "nl" ? "uitgaven" : "expenses"}
                </span>
              </div>
              <strong>
                −
                {money(
                  dayItems
                    .filter((item) => item.type === "expense")
                    .reduce((sum, item) => sum + item.baseAmountCents, 0),
                  displayCurrency,
                  rates,
                  language,
                  2,
                )}
              </strong>
            </div>
            {dayItems.map((item) => {
              const member = members.find((m) => m.id === item.memberId);
              const color = categoryColor(item.category);
              return (
                <div className="transaction" key={item.id}>
                  <span
                    className="category-icon"
                    style={{ color, background: `${color}18` }}
                  >
                    {categoryIcons[item.category] ?? "•"}
                  </span>
                  <div className="transaction-copy">
                    <b>{item.note}</b>
                    <span>
                      {categoryLabel(language, item.category)} · {member?.name} ·{" "}
                      {new Date(item.happenedAt).toLocaleTimeString(
                        language === "nl" ? "nl-NL" : "en-GB",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                      {` · ${item.source === "telegram" ? "Telegram" : "Web"}`}
                      {item.currency !== baseCurrency
                        ? ` · ${currencySymbols[item.currency as Currency] ?? item.currency}${(item.amountCents / 100).toFixed(2)} ${t.entered}`
                        : ""}
                    </span>
                  </div>
                  {(item.memberId === currentMemberId || isOwner) && (
                    <button
                      className="edit-transaction"
                      onClick={() => onEdit(item)}
                    >
                      {item.memberId === currentMemberId
                        ? language === "nl"
                          ? "Bewerken"
                          : "Edit"
                        : language === "nl"
                          ? "Beheren"
                          : "Manage"}
                    </button>
                  )}
                  <span
                    className="mini-avatar"
                    title={member?.name}
                    aria-label={member?.name}
                    style={{ background: member?.color }}
                  >
                    {initials(member?.name ?? "?")}
                  </span>
                  <strong className="transaction-amount">
                    −
                    {money(
                      item.baseAmountCents,
                      displayCurrency,
                      rates,
                      language,
                      2,
                    )}
                  </strong>
                </div>
              );
            })}
          </section>
        ))}
        {!groups.length && <p className="modal-copy">{t.emptyText}</p>}
      </div>
    </Modal>
  );
}

function BudgetCard({
  transactions,
  adjustmentCents,
  dailyBudgetRules,
  baseCurrency,
  language,
  displayCurrency,
  rates,
  isOwner,
  onAdjust,
  onConfigure,
}: {
  transactions: Array<
    Pick<Transaction, "type" | "baseAmountCents" | "happenedAt">
  >;
  adjustmentCents: number;
  dailyBudgetRules: DashboardData["dailyBudgetRules"];
  baseCurrency: Currency;
  language: Language;
  displayCurrency: Currency;
  rates?: Record<string, number>;
  isOwner: boolean;
  onAdjust: () => void;
  onConfigure: () => void;
}) {
  const status = calculateBudgetStatus(
    transactions,
    new Date(),
    adjustmentCents,
    dailyBudgetRules,
    baseCurrency,
  );
  const budgetMoney = (cents: number) =>
    money(Math.abs(cents), displayCurrency, rates, language, 2);
  const totalMoney = (cents: number) =>
    money(cents, displayCurrency, rates, language, 2);
  const signed = (cents: number) =>
    `${cents >= 0 ? "+" : "−"} ${budgetMoney(cents)}`;
  const dailyText =
    status.dailyState === "neutral"
      ? language === "nl"
        ? `${budgetMoney(status.dailyBudgetCents)} vandaag beschikbaar`
        : `${budgetMoney(status.dailyBudgetCents)} available today`
      : status.dailyState === "under"
        ? `${budgetMoney(status.dailyDifferenceCents)} ${language === "nl" ? "vandaag beschikbaar" : "available today"}`
        : `${budgetMoney(status.dailyDifferenceCents)} ${language === "nl" ? "boven de daglimiet" : "above today’s limit"}`;
  const totalState =
    status.totalAvailableThroughMonthEndCents < 0
      ? "over"
      : status.totalAvailableThroughMonthEndCents <
          status.plannedBudgetIncludingTodayCents
        ? "under"
        : "neutral";
  const remainingText =
    language === "nl"
      ? `Na vandaag: ${status.remainingDaysAfterToday} dagen · ${budgetMoney(status.remainingBudgetAfterTodayCents)} gepland met ${budgetMoney(status.dailyBudgetCents)} per dag`
      : `After today: ${status.remainingDaysAfterToday} days · ${budgetMoney(status.remainingBudgetAfterTodayCents)} planned at ${budgetMoney(status.dailyBudgetCents)} per day`;
  const carryoverText =
    language === "nl"
      ? `Saldo van eerdere dagen: ${signed(status.previousDaysCarryoverCents)}`
      : `Balance carried from previous days: ${signed(status.previousDaysCarryoverCents)}`;
  const averageText =
    status.remainingDaysAfterToday === 0
      ? language === "nl"
        ? "De maand eindigt vandaag"
        : "The month ends today"
      : language === "nl"
        ? `Vanaf morgen: ${totalMoney(status.totalAvailableThroughMonthEndCents)} ÷ ${status.remainingDaysAfterToday} dagen = ${budgetMoney(status.recommendedDailyAverageCents)} per dag`
        : `From tomorrow: ${totalMoney(status.totalAvailableThroughMonthEndCents)} ÷ ${status.remainingDaysAfterToday} days = ${budgetMoney(status.recommendedDailyAverageCents)} per day`;
  return (
    <section
      className={`budget-card ${status.dailyState}`}
      aria-label={language === "nl" ? "Gezinsbudget" : "Family budget"}
    >
      <div>
        <span>
          {language === "nl" ? "DAGELIJKS GEZINSBUDGET" : "FAMILY DAILY BUDGET"}
        </span>
        <h2>
          {budgetMoney(status.todaySpentCents)}{" "}
          <small>/ {budgetMoney(status.dailyBudgetCents)}</small>
        </h2>
        <p>{dailyText}</p>
      </div>
      <div className={`budget-month ${totalState}`}>
        <span>
          {language === "nl" ? "TOT HET EINDE VAN DE MAAND" : "THROUGH MONTH END"}
        </span>
        <b>
          {totalMoney(status.totalAvailableThroughMonthEndCents)}{" "}
          <small>{language === "nl" ? "beschikbaar" : "available"}</small>
        </b>
        <p>{carryoverText}</p>
        <p>{remainingText}</p>
        <p>
          {budgetMoney(status.remainingBudgetAfterTodayCents)}{" "}
          {signed(status.dailyDifferenceCents)}{" "}
          {signed(status.previousDaysCarryoverCents)}{" "}
          {status.adjustmentCents
            ? `${signed(status.adjustmentCents)} `
            : ""}
          = {totalMoney(status.totalAvailableThroughMonthEndCents)} ·{" "}
          {averageText}
        </p>
        {isOwner && (
          <div className="budget-owner-actions">
            <button className="budget-adjust-button" onClick={onAdjust}>
              {language === "nl"
                ? "Resterend budget aanpassen"
                : "Adjust remaining budget"}
            </button>
            <button className="budget-adjust-button" onClick={onConfigure}>
              {language === "nl"
                ? "Dagbudget en basisvaluta"
                : "Daily budget & base currency"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function BudgetAdjustmentModal({
  language,
  data,
  demoMode,
  onClose,
  onUpdated,
}: {
  language: Language;
  data: DashboardData;
  demoMode: boolean;
  onClose: () => void;
  onUpdated: (data: DashboardData) => void;
}) {
  const baseCurrency = data.household.baseCurrency as Currency;
  const baseSymbol = currencySymbols[baseCurrency];
  const [amount, setAmount] = useState(
    (data.budgetAdjustmentCents / 100).toFixed(2),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value)) {
      setError(language === "nl" ? "Voer een geldig bedrag in." : "Enter a valid amount.");
      return;
    }
    if (demoMode) {
      const cents = Math.round(value * 100);
      onUpdated({
        ...data,
        budgetAdjustmentCents: cents,
        monthlyBudgetAdjustments: [
          ...data.monthlyBudgetAdjustments.filter(
            (item) => item.month !== budgetMonthKey(),
          ),
          { month: budgetMonthKey(), adjustmentCents: cents },
        ],
        household: { ...data.household, budgetAdjustmentCents: cents },
      });
      onClose();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "updateBudgetAdjustment", amount: value }),
      });
      const result = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not update budget");
      onUpdated(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update budget");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow={language === "nl" ? "GEZINSBUDGET" : "FAMILY BUDGET"}
      title={language === "nl" ? "Resterend budget aanpassen" : "Adjust remaining budget"}
      closeLabel={language === "nl" ? "Sluiten" : "Close"}
      onClose={onClose}
    >
      <p className="modal-copy">
        {language === "nl"
          ? "Gebruik een positief bedrag om geld toe te voegen of een negatief bedrag om het budget van deze maand te verlagen. De daglimiet blijft ongewijzigd."
          : "Use a positive amount to add money or a negative amount to reduce this month’s remaining budget. The daily limit stays unchanged."}
      </p>
      <form className="expense-form" onSubmit={save}>
        <label>
          <span>
            {language === "nl"
              ? `Aanpassing in ${baseCurrency}`
              : `Adjustment in ${baseCurrency}`}
          </span>
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="10.00 or -30.00"
          />
        </label>
        <div className="budget-examples">
          <button type="button" onClick={() => setAmount("10.00")}>+ {baseSymbol}10</button>
          <button type="button" onClick={() => setAmount("-30.00")}>− {baseSymbol}30</button>
          <button type="button" onClick={() => setAmount("0.00")}>
            {language === "nl" ? "Wissen" : "Clear"}
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="text-button" onClick={onClose}>
            {language === "nl" ? "Annuleren" : "Cancel"}
          </button>
          <button className="primary-button" disabled={saving}>
            {saving
              ? language === "nl"
                ? "Opslaan…"
                : "Saving…"
              : language === "nl"
                ? "Opslaan"
                : "Save adjustment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FamilyBudgetSettingsModal({
  language,
  data,
  demoMode,
  onClose,
  onUpdated,
}: {
  language: Language;
  data: DashboardData;
  demoMode: boolean;
  onClose: () => void;
  onUpdated: (data: DashboardData) => void;
}) {
  const today = expenseDayKey(new Date());
  const currentRule = [...data.dailyBudgetRules]
    .filter((item) => item.effectiveDate <= today)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  const [dailyBudget, setDailyBudget] = useState(
    ((currentRule?.dailyBudgetCents ?? 2_000) / 100).toFixed(2),
  );
  const [baseCurrency, setBaseCurrency] = useState<Currency>(
    data.household.baseCurrency as Currency,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    const amount = Number(dailyBudget);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(
        language === "nl"
          ? "Voer een dagbudget groter dan nul in."
          : "Enter a daily budget greater than zero.",
      );
      return;
    }
    if (demoMode) {
      const cents = Math.round(amount * 100);
      onUpdated({
        ...data,
        household: {
          ...data.household,
          baseCurrency,
          setupCompletedAt: new Date().toISOString(),
        },
        dailyBudgetRules: [
          ...data.dailyBudgetRules.filter((item) => item.effectiveDate !== today),
          { effectiveDate: today, dailyBudgetCents: cents },
        ],
      });
      onClose();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "updateFamilyBudgetSettings",
          dailyBudget: amount,
          baseCurrency,
        }),
      });
      const result = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok)
        throw new Error(result.error || "Could not update family budget settings");
      onUpdated(result);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update family budget settings",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow={language === "nl" ? "GEZINSINSTELLINGEN" : "FAMILY SETUP"}
      title={
        language === "nl"
          ? "Dagbudget en basisvaluta"
          : "Daily budget and base currency"
      }
      closeLabel={language === "nl" ? "Sluiten" : "Close"}
      onClose={onClose}
    >
      <p className="modal-copy">
        {language === "nl"
          ? "De wijziging geldt vanaf vandaag. Eerdere dagen en hun positieve of negatieve saldo blijven ongewijzigd. Het nieuwe dagbudget blijft ook in volgende maanden gelden totdat de eigenaar het opnieuw wijzigt."
          : "The change starts today. Previous days and their positive or negative balance stay unchanged. The new daily budget also continues into future months until the owner changes it again."}
      </p>
      <form className="expense-form" onSubmit={save}>
        <div className="form-grid">
          <label>
            <span>{language === "nl" ? "Dagbudget" : "Daily budget"}</span>
            <input
              required
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={dailyBudget}
              onChange={(event) => setDailyBudget(event.target.value)}
            />
          </label>
          <label>
            <span>{language === "nl" ? "Basisvaluta" : "Base currency"}</span>
            <select
              value={baseCurrency}
              onChange={(event) => setBaseCurrency(event.target.value as Currency)}
            >
              {displayCurrencies.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="modal-copy">
          {language === "nl"
            ? "De basisvaluta wordt gebruikt voor budgetten, Telegram en berekeningen. De weergavevaluta bovenaan verandert alleen hoe bedragen worden getoond. Bij een wijziging van de basisvaluta worden bestaande bedragen omgerekend om hun waarde te behouden."
            : "The base currency is used for budgets, Telegram, and calculations. Display currency at the top only changes how amounts are shown. If the base currency changes, existing amounts are converted to preserve their value."}
        </p>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          {data.household.setupCompletedAt && (
            <button type="button" className="text-button" onClick={onClose}>
              {language === "nl" ? "Annuleren" : "Cancel"}
            </button>
          )}
          <button className="primary-button" disabled={saving}>
            {saving
              ? language === "nl" ? "Opslaan…" : "Saving…"
              : language === "nl" ? "Instellingen opslaan" : "Save settings"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MonthlyHistoryCard({
  transactions,
  monthlyBudgetAdjustments,
  dailyBudgetRules,
  language,
  formatMoney,
  scopeName,
  familyView,
}: {
  transactions: Transaction[];
  monthlyBudgetAdjustments: DashboardData["monthlyBudgetAdjustments"];
  dailyBudgetRules: DashboardData["dailyBudgetRules"];
  language: Language;
  formatMoney: (cents: number, digits?: number) => string;
  scopeName: string;
  familyView: boolean;
}) {
  const currentKey = monthKey(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentKey);
  const monthlyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    transactions
      .filter((item) => item.type === "expense")
      .forEach((item) => {
        const key = monthKey(new Date(item.happenedAt));
        totals.set(key, (totals.get(key) ?? 0) + item.baseAmountCents);
      });
    return totals;
  }, [transactions]);
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() - index);
        return monthKey(date);
      }),
    [],
  );
  const selectedDate = monthFromKey(selectedMonth);
  const previousDate = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth() - 1,
    1,
  );
  const selectedTotal = monthlyTotals.get(selectedMonth) ?? 0;
  const selectedAdjustment =
    monthlyBudgetAdjustments.find((item) => item.month === selectedMonth)
      ?.adjustmentCents ?? 0;
  const selectedPlan = monthlyBudgetPlanCents(
    selectedMonth,
    selectedAdjustment,
    dailyBudgetRules,
  );
  const selectedBalance = selectedPlan - selectedTotal;
  const previousTotal = monthlyTotals.get(monthKey(previousDate)) ?? 0;
  const reduction = previousTotal
    ? Math.round(((previousTotal - selectedTotal) / previousTotal) * 100)
    : null;
  const chartMonths = [...months].reverse();
  const max = Math.max(...chartMonths.map((key) => monthlyTotals.get(key) ?? 0), 1);

  return (
    <section className="panel monthly-history">
      <div className="panel-head">
        <div>
          <span className="eyebrow">
            {language === "nl" ? "12 MAANDEN" : "12 MONTHS"}
          </span>
          <h2>
            {familyView
              ? language === "nl"
                ? "Gezinsgeschiedenis"
                : "Family history"
              : language === "nl"
                ? `Geschiedenis van ${scopeName}`
                : `${scopeName}'s history`}
          </h2>
        </div>
        <select
          aria-label={language === "nl" ? "Kies een maand" : "Choose a month"}
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
        >
          {months.map((key) => (
            <option key={key} value={key}>
              {monthLabel(key, language)}
            </option>
          ))}
        </select>
      </div>
      <div className="history-summary">
        <div>
          <span>{monthLabel(selectedMonth, language)}</span>
          <b>{formatMoney(selectedTotal, 2)}</b>
        </div>
        <p>
          {reduction === null
            ? language === "nl"
              ? "Nog geen uitgaven in de vorige maand om mee te vergelijken."
              : "No spending in the previous month to compare yet."
            : reduction >= 0
              ? language === "nl"
                ? `${reduction}% minder uitgegeven dan ${monthLabel(monthKey(previousDate), language)}.`
                : `${reduction}% less spent than ${monthLabel(monthKey(previousDate), language)}.`
              : language === "nl"
                ? `${Math.abs(reduction)}% meer uitgegeven dan ${monthLabel(monthKey(previousDate), language)}.`
                : `${Math.abs(reduction)}% more spent than ${monthLabel(monthKey(previousDate), language)}.`}
        </p>
        {familyView && selectedPlan > 0 && (
          <p>
            {selectedMonth === currentKey
              ? language === "nl"
                ? `${formatMoney(selectedBalance, 2)} blijft beschikbaar van het maandbudget van ${formatMoney(selectedPlan, 2)}.`
                : `${formatMoney(selectedBalance, 2)} remains available from the ${formatMoney(selectedPlan, 2)} monthly plan.`
              : selectedBalance >= 0
                ? language === "nl"
                  ? `Maand afgesloten met ${formatMoney(selectedBalance, 2)} onder het plan van ${formatMoney(selectedPlan, 2)}.`
                  : `Month closed ${formatMoney(selectedBalance, 2)} under the ${formatMoney(selectedPlan, 2)} plan.`
                : language === "nl"
                  ? `Maand afgesloten met ${formatMoney(Math.abs(selectedBalance), 2)} boven het plan van ${formatMoney(selectedPlan, 2)}.`
                  : `Month closed ${formatMoney(Math.abs(selectedBalance), 2)} over the ${formatMoney(selectedPlan, 2)} plan.`}
          </p>
        )}
      </div>
      <div className="history-bars" role="img" aria-label={language === "nl" ? "Uitgaven per maand" : "Spending by month"}>
        {chartMonths.map((key) => {
          const total = monthlyTotals.get(key) ?? 0;
          return (
            <div key={key} title={`${monthLabel(key, language)}: ${formatMoney(total, 2)}`}>
              <i style={{ height: `${Math.max(3, (total / max) * 100)}%` }} />
              <span>{monthFromKey(key).toLocaleDateString(language === "nl" ? "nl-NL" : "en-GB", { month: "short" })}</span>
            </div>
          );
        })}
      </div>
      <small>
        {familyView
          ? language === "nl"
            ? "Dit is de gecombineerde uitgave van het hele gezin; verwijderde uitgaven worden niet meegerekend."
            : "This is combined household spending; deleted expenses are excluded."
          : language === "nl"
            ? `Dit overzicht bevat alleen de uitgaven van ${scopeName}.`
            : `This view contains only ${scopeName}'s spending.`}
      </small>
    </section>
  );
}

export default function Dashboard({
  initialData,
}: {
  initialData: DashboardData;
}) {
  const [data, setData] = useState(initialData);
  const [external, setExternal] = useState<ExternalData | null>(null);
  const [modal, setModal] = useState<
    | "expense"
    | "edit"
    | "invite"
    | "members"
    | "activity"
    | "settings"
    | "budget"
    | "budgetSettings"
    | null
  >(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [showTelegram, setShowTelegram] = useState(false);
  const [dark, setDark] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [lastSync, setLastSync] = useState(0);
  const [botStatus, setBotStatus] = useState({
    configured: false,
    webhookReady: false,
  });
  const [language, setLanguage] = useState<Language>("en");
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(
    data.household.baseCurrency as Currency,
  );
  const [scope, setScope] = useState<string>("family");
  const [selectedDay, setSelectedDay] = useState(() => expenseDayKey(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [publicDemo, setPublicDemo] = useState(false);
  const [secureAppUrl, setSecureAppUrl] = useState("");
  const testModeRef = useRef(false);
  const t = copy[language];
  const referenceRates = external?.rates;
  const rates = useMemo(
    () =>
      ratesFromBase(
        referenceRates,
        data.household.baseCurrency as Currency,
      ),
    [referenceRates, data.household.baseCurrency],
  );
  const formatMoney = useCallback(
    (cents: number, digits = 0) =>
      money(cents, displayCurrency, rates, language, digits),
    [displayCurrency, rates, language],
  );

  const refresh = useCallback(async () => {
    if (testModeRef.current) return;
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) return;
      const fresh = (await response.json()) as DashboardData;
      if (fresh?.household && fresh?.members) {
        setData(fresh);
        setIsDemo(false);
        setLastSync(Date.now());
        const signedInMember = fresh.members.find(
          (member) => member.id === fresh.currentMemberId,
        );
        if (
          signedInMember?.role === "owner" &&
          !fresh.household.setupCompletedAt
        ) {
          setModal("budgetSettings");
        }
      }
    } catch {
      /* sample view remains available */
    }
  }, []);
  useEffect(() => {
    fetch("/api/public-config", { cache: "no-store" })
      .then((response) =>
        response.json<{ publicDemo?: boolean; secureAppUrl?: string }>(),
      )
      .then((config) => {
        if (!config.publicDemo) return;
        testModeRef.current = true;
        setPublicDemo(true);
        setSecureAppUrl(config.secureAppUrl ?? "");
        setData(createDemoData());
        setIsDemo(true);
        setScope("family");
      })
      .catch(() => null);
  }, []);
  useEffect(() => {
    const first = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    fetch(`/api/external?city=${encodeURIComponent(data.household.city)}`)
      .then((r) => r.json<ExternalData>())
      .then(setExternal)
      .catch(() => null);
  }, [data.household.city]);
  const refreshBotStatus = useCallback(() => {
    fetch("/api/telegram")
      .then((r) => r.json<{ configured?: boolean; webhookReady?: boolean }>())
      .then((result: { configured?: boolean; webhookReady?: boolean }) =>
        setBotStatus({
          configured: Boolean(result.configured),
          webhookReady: Boolean(result.webhookReady),
        }),
      )
      .catch(() => null);
  }, []);
  useEffect(() => {
    refreshBotStatus();
  }, [refreshBotStatus]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.lang = language;
  }, [dark, language]);

  function enterTestMode() {
    testModeRef.current = true;
    setData(createDemoData());
    setScope("family");
    setIsDemo(true);
    setShowTelegram(false);
    setSelectedDay(expenseDayKey(new Date()));
    setCalendarOpen(false);
  }
  function exitTestMode() {
    if (publicDemo) {
      if (secureAppUrl) window.location.assign(secureAppUrl);
      return;
    }
    testModeRef.current = false;
    setIsDemo(false);
    refresh();
  }
  function scrollTo(id: string) {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const activeMembers = data.members.filter(
    (member) => member.status === "active",
  );
  const currentMember =
    activeMembers.find((member) => member.id === data.currentMemberId) ??
    activeMembers[0];
  const isOwner = currentMember?.role === "owner";
  const canViewHousehold =
    isOwner || Boolean(currentMember?.canViewHousehold);
  const visibleTransactions = useMemo(
    () =>
      canViewHousehold
        ? scope === "family"
          ? data.transactions
          : data.transactions.filter(
              (item) =>
                item.memberId ===
                (isOwner ? scope : data.currentMemberId),
            )
        : data.transactions.filter(
            (item) => item.memberId === data.currentMemberId,
          ),
    [
      data.transactions,
      data.currentMemberId,
      canViewHousehold,
      isOwner,
      scope,
    ],
  );
  const selectedDayTransactions = useMemo(
    () =>
      visibleTransactions.filter(
        (item) =>
          item.type === "expense" && expenseDayKey(item.happenedAt) === selectedDay,
      ),
    [visibleTransactions, selectedDay],
  );
  const expenseDays = useMemo(
    () =>
      new Set(
        visibleTransactions
          .filter((item) => item.type === "expense")
          .map((item) => expenseDayKey(item.happenedAt)),
      ),
    [visibleTransactions],
  );
  const todayKey = expenseDayKey(new Date());
  const selectedScopeName =
    canViewHousehold && scope === "family"
      ? t.everyone
      : activeMembers.find(
          (member) =>
            member.id === (isOwner ? scope : data.currentMemberId),
        )?.name ?? currentMember?.name ?? "";
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentTotal = visibleTransactions
    .filter(
      (item) =>
        monthKey(new Date(item.happenedAt)) === monthKey(now) &&
        item.type === "expense",
    )
    .reduce((sum, item) => sum + item.baseAmountCents, 0);
  const previousTotal = visibleTransactions
    .filter(
      (item) =>
        monthKey(new Date(item.happenedAt)) === monthKey(previous) &&
        item.type === "expense",
    )
    .reduce((sum, item) => sum + item.baseAmountCents, 0);
  const change = previousTotal
    ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
    : 0;
  const allCategoryNames = Array.from(
    new Set([
      ...categories,
      ...data.categories.map((item) => item.name),
      ...visibleTransactions.map((item) => item.category),
    ]),
  );
  const categoryTotals = allCategoryNames
    .map((category) => ({
      category,
      total: visibleTransactions
        .filter((item) => item.category === category && item.type === "expense")
        .reduce((sum, item) => sum + item.baseAmountCents, 0),
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
  const categorySum =
    categoryTotals.reduce((sum, item) => sum + item.total, 0) || 1;
  const donut = categoryTotals
    .map((item, index) => {
      const start = categoryTotals
        .slice(0, index)
        .reduce((sum, prior) => sum + (prior.total / categorySum) * 360, 0);
      const end = start + (item.total / categorySum) * 360;
      return `${categoryColor(item.category)} ${start}deg ${end}deg`;
    })
    .join(", ");
  const weekly = Array.from({ length: 8 }, (_, index) => {
    const end = new Date();
    end.setDate(end.getDate() - (7 - index) * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return (
      visibleTransactions
        .filter((item) => {
          const date = new Date(item.happenedAt);
          return date >= start && date <= end && item.type === "expense";
        })
        .reduce((sum, item) => sum + item.baseAmountCents, 0) / 100
    );
  });
  const maxWeekly = Math.max(...weekly, 1);
  const points = weekly
    .map(
      (value, index) => `${10 + index * 40},${112 - (value / maxWeekly) * 88}`,
    )
    .join(" ");
  const weather = weatherLabel(
    external?.weather?.current?.weather_code,
    language,
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <strong>Family Expenses</strong>
            <span>Your household, beautifully organized</span>
          </div>
        </div>
        <nav aria-label="Primary">
          <button
            className="nav-item active"
            onClick={() => scrollTo("overview")}
          >
            <span>⌂</span>
            {t.overview}
          </button>
          <button className="nav-item" onClick={() => scrollTo("activity")}>
            <span>↕</span>
            {t.activity}
          </button>
          <button
            className="nav-item"
            onClick={() => setShowTelegram((value) => !value)}
          >
            <span>↗</span>
            {t.telegram}
          </button>
        </nav>
        <div className="side-label">
          {canViewHousehold
            ? t.household.toUpperCase()
            : language === "nl"
              ? "MIJN PROFIEL"
              : "MY PROFILE"}
        </div>
        <div className="scope-list">
          {canViewHousehold && (
            <button
              className={`scope ${scope === "family" ? "active" : ""}`}
              onClick={() => setScope("family")}
            >
              <span className="family-avatar">∞</span>
              <div>
                <b>{t.everyone}</b>
                <small>{t.combined}</small>
              </div>
              <em>
                {formatMoney(
                  data.transactions
                    .filter((item) => item.type === "expense")
                    .reduce((sum, item) => sum + item.baseAmountCents, 0),
                )}
              </em>
            </button>
          )}
          {(isOwner ? activeMembers : currentMember ? [currentMember] : []).map((member) => (
            <button
              key={member.id}
              className={`scope ${(!canViewHousehold || scope === member.id) ? "active" : ""}`}
              onClick={() => canViewHousehold && setScope(member.id)}
            >
              <span
                className="avatar"
                style={{ background: member.color }}
              >
                {initials(member.name)}
              </span>
              <div>
                <b>{member.name}</b>
                <small>
                  {member.id === data.currentMemberId && member.role === "owner"
                    ? language === "nl"
                      ? "Eigenaar · jij"
                      : "Owner · you"
                    : member.id === data.currentMemberId
                      ? t.you
                      : t.member}
                </small>
              </div>
              <em>
                {formatMoney(
                  data.transactions
                    .filter((item) => item.memberId === member.id)
                    .filter((item) => item.type === "expense")
                    .reduce((sum, item) => sum + item.baseAmountCents, 0),
                )}
              </em>
            </button>
          ))}
        </div>
        {isOwner && (
          <>
            <button
              className="invite-button"
              onClick={() => setModal("invite")}
            >
              ＋ {t.invite}
            </button>
            <button
              className="manage-button"
              onClick={() => setModal("members")}
            >
              ⚙ {t.manageMembers}
            </button>
          </>
        )}
        <div className="sidebar-bottom">
          <button onClick={() => setShowTelegram((value) => !value)}>
            <span>↗</span>
            {t.telegramBot}
            <i
              className={
                botStatus.webhookReady ? "status-dot ready" : "status-dot"
              }
            />
          </button>
          <button onClick={isDemo ? exitTestMode : enterTestMode}>
            <span>◌</span>
            {isDemo
              ? publicDemo
                ? language === "nl"
                  ? "Veilig inloggen"
                  : "Secure sign in"
                : t.exitTest
              : t.trySample}
          </button>
        </div>
      </aside>

      <main className="dashboard-main" id="overview">
        <header className="topbar">
          <div>
            <div className="date-navigator">
              <button
                type="button"
                className="date-arrow"
                onClick={() => {
                  setSelectedDay((day) => shiftDayKey(day, -1));
                  setCalendarOpen(false);
                }}
                aria-label={t.previousDay}
              >
                ‹
              </button>
              <button
                type="button"
                className="date-line date-trigger"
                onClick={() => setCalendarOpen((open) => !open)}
                aria-expanded={calendarOpen}
              >
                {selectedDay === todayKey ? t.today : t.selectedDay} ·{" "}
                {readableDay(selectedDay, language)}
                <span aria-hidden="true">▾</span>
              </button>
              <button
                type="button"
                className="date-arrow"
                disabled={selectedDay >= todayKey}
                onClick={() => {
                  setSelectedDay((day) => shiftDayKey(day, 1));
                  setCalendarOpen(false);
                }}
                aria-label={t.nextDay}
              >
                ›
              </button>
              {selectedDay !== todayKey && (
                <button
                  type="button"
                  className="today-shortcut"
                  onClick={() => {
                    setSelectedDay(todayKey);
                    setCalendarOpen(false);
                  }}
                >
                  {t.backToToday}
                </button>
              )}
              {calendarOpen && (
                <ExpenseCalendar
                  selectedDay={selectedDay}
                  expenseDays={expenseDays}
                  language={language}
                  onSelect={(day) => {
                    setSelectedDay(day);
                    setCalendarOpen(false);
                  }}
                  onClose={() => setCalendarOpen(false)}
                />
              )}
            </div>
            <h1>{`${t.hello}, ${currentMember?.name ?? ""}.`}</h1>
            <p>{t.subtitle}</p>
          </div>
          <div className="top-actions">
            <label className="header-select">
              <span>{t.language}</span>
              <select
                aria-label={t.language}
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                <option value="en">EN</option>
                <option value="nl">NL</option>
              </select>
            </label>
            <label className="header-select currency">
              <span>{t.displayCurrency}</span>
              <select
                aria-label={t.displayCurrency}
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value as Currency)}
              >
                {displayCurrencies.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            {!isDemo && (
              <button className="test-button" onClick={enterTestMode}>
                ◌ {t.testDrive}
              </button>
            )}
            <div className="live-chip">
              <i />
              <span>{isDemo ? t.test : t.live}</span>
              <small>
                {isDemo ? t.sampleData : lastSync ? t.justNow : t.syncing}
              </small>
            </div>
            <button
              className="theme-button"
              onClick={() => setDark((value) => !value)}
              aria-label="Theme"
            >
              {dark ? "☀" : "☾"}
            </button>
            <button
              className="avatar top-avatar"
              style={{ background: currentMember?.color }}
              onClick={() => setModal("settings")}
              aria-label={
                language === "nl" ? "Mijn instellingen" : "My settings"
              }
            >
              {initials(currentMember?.name ?? "Me")}
            </button>
          </div>
        </header>

        {isDemo && (
          <div className="demo-banner">
            <span>{t.testMode}</span>
            {t.testMessage}
            <button
              onClick={exitTestMode}
              disabled={publicDemo && !secureAppUrl}
            >
              {publicDemo
                ? language === "nl"
                  ? "Inloggen op mijn dashboard"
                  : "Sign in to my dashboard"
                : t.exitTest}
            </button>
          </div>
        )}
        <section className="panel daily-ledger" aria-live="polite">
          <div className="panel-head daily-ledger-head">
            <div>
              <span className="eyebrow">{t.dailyExpenses}</span>
              <h2>{readableDay(selectedDay, language)}</h2>
              <p>
                {selectedScopeName} · {selectedDayTransactions.length}{" "}
                {language === "nl" ? "uitgaven" : "expenses"}
              </p>
            </div>
            <strong>
              −
              {formatMoney(
                selectedDayTransactions.reduce(
                  (sum, item) => sum + item.baseAmountCents,
                  0,
                ),
                2,
              )}
            </strong>
          </div>
          <div className="daily-transaction-list">
            {selectedDayTransactions.map((item) => {
              const member = data.members.find(
                (person) => person.id === item.memberId,
              );
              const color = categoryColor(item.category);
              return (
                <div className="transaction" key={item.id}>
                  <span
                    className="category-icon"
                    style={{ color, background: `${color}18` }}
                  >
                    {categoryIcons[item.category] ?? "•"}
                  </span>
                  <div className="transaction-copy">
                    <b>{item.note}</b>
                    <span>
                      {categoryLabel(language, item.category)} · {member?.name} ·{" "}
                      {new Date(item.happenedAt).toLocaleTimeString(
                        language === "nl" ? "nl-NL" : "en-GB",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                      {` · ${item.source === "telegram" ? "Telegram" : "Web"}`}
                    </span>
                  </div>
                  {(item.memberId === data.currentMemberId || isOwner) && (
                    <button
                      className="edit-transaction"
                      onClick={() => {
                        setSelectedTransaction(item);
                        setModal("edit");
                      }}
                    >
                      {item.memberId === data.currentMemberId
                        ? language === "nl"
                          ? "Bewerken"
                          : "Edit"
                        : language === "nl"
                          ? "Beheren"
                          : "Manage"}
                    </button>
                  )}
                  <span
                    className="mini-avatar"
                    title={member?.name}
                    aria-label={member?.name}
                    style={{ background: member?.color }}
                  >
                    {initials(member?.name ?? "?")}
                  </span>
                  <strong className="transaction-amount">
                    −{formatMoney(item.baseAmountCents, 2)}
                  </strong>
                </div>
              );
            })}
            {!selectedDayTransactions.length && (
              <div className="daily-empty">
                <span>○</span>
                <p>{t.noExpensesOnDay}</p>
              </div>
            )}
          </div>
        </section>
        {showTelegram && currentMember && (
          <TelegramPanel
            current={currentMember}
            configured={botStatus.configured}
            ready={botStatus.webhookReady}
            language={language}
            onActivated={() => {
              refreshBotStatus();
              refresh();
            }}
            onUpdated={setData}
          />
        )}
        {!isDemo && (
          <BudgetCard
            transactions={data.familyBudgetTransactions}
            adjustmentCents={data.budgetAdjustmentCents}
            dailyBudgetRules={data.dailyBudgetRules}
            baseCurrency={data.household.baseCurrency as Currency}
            language={language}
            displayCurrency={displayCurrency}
            rates={rates}
            isOwner={isOwner}
            onAdjust={() => setModal("budget")}
            onConfigure={() => setModal("budgetSettings")}
          />
        )}
        {!isDemo && isOwner && (
          <MonthlyHistoryCard
            transactions={visibleTransactions}
            monthlyBudgetAdjustments={data.monthlyBudgetAdjustments}
            dailyBudgetRules={data.dailyBudgetRules}
            language={language}
            formatMoney={formatMoney}
            scopeName={
              scope === "family"
                ? t.everyone
                : activeMembers.find((member) => member.id === scope)?.name ?? ""
            }
            familyView={scope === "family"}
          />
        )}

        <section className="metric-grid">
          <article className="metric hero-metric">
            <div className="metric-top">
              <span>{t.spentMonth}</span>
              <i>↗</i>
            </div>
            <strong>{formatMoney(currentTotal)}</strong>
            <p className={change > 0 ? "up" : "down"}>
              {change === 0
                ? t.freshMonth
                : `${change > 0 ? "↑" : "↓"} ${Math.abs(change)}% ${t.fromLastMonth}`}
            </p>
            <div className="sparkbars">
              {[31, 48, 37, 66, 52, 79, 58, 92, 73, 85, 62, 96].map(
                (height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ),
              )}
            </div>
          </article>
          <article className="metric">
            <div className="metric-top">
              <span>{t.dailyAverage}</span>
              <i>○</i>
            </div>
            <strong>
              {formatMoney(currentTotal / Math.max(now.getDate(), 1))}
            </strong>
            <p>{isOwner && scope === "family" ? t.combined : t.thisMember}</p>
            <div className="member-strips">
              {currentMember && (
                <span style={{ background: currentMember.color }} />
              )}
            </div>
          </article>
          <article className="metric">
            <div className="metric-top">
              <span>{t.topCategory}</span>
              <i>{categoryIcons[categoryTotals[0]?.category] ?? "•"}</i>
            </div>
            <strong className="category-title">
              {categoryTotals[0]
                ? categoryLabel(language, categoryTotals[0].category)
                : t.nothingYet}
            </strong>
            <p>
              {categoryTotals[0]
                ? `${formatMoney(categoryTotals[0].total)} · ${Math.round((categoryTotals[0].total / categorySum) * 100)}%`
                : t.firstEntry}
            </p>
            <div className="progress">
              <i
                style={{
                  width: `${categoryTotals[0] ? (categoryTotals[0].total / categorySum) * 100 : 0}%`,
                }}
              />
            </div>
          </article>
          <article className="metric weather-card">
            <div>
              <div className="metric-top">
                <span>
                  {external?.place?.name?.toUpperCase() ??
                    data.household.city.toUpperCase()}
                </span>
                <i>{weather.icon}</i>
              </div>
              <strong>
                {Math.round(external?.weather?.current?.temperature_2m ?? 21)}°
              </strong>
              <p>
                {weather.label} · {t.feels}{" "}
                {Math.round(
                  external?.weather?.current?.apparent_temperature ?? 20,
                )}
                °
              </p>
            </div>
            <div className="weather-range">
              <span>
                {t.high}{" "}
                {Math.round(
                  external?.weather?.daily?.temperature_2m_max?.[0] ?? 24,
                )}
                °
              </span>
              <span>
                {t.low}{" "}
                {Math.round(
                  external?.weather?.daily?.temperature_2m_min?.[0] ?? 15,
                )}
                °
              </span>
            </div>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel trend-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">{t.last8}</span>
                <h2>{t.rhythm}</h2>
              </div>
              <div className="legend">
                {currentMember && (
                  <span>
                    <i style={{ background: currentMember.color }} />
                    {isOwner && scope === "family"
                      ? t.everyone
                      : activeMembers.find((member) => member.id === scope)?.name ??
                        currentMember.name}
                  </span>
                )}
              </div>
            </div>
            <div className="chart-wrap">
              <div className="y-labels">
                <span>{formatMoney(maxWeekly * 100)}</span>
                <span>{formatMoney(maxWeekly * 50)}</span>
                <span>{formatMoney(0)}</span>
              </div>
              <svg
                viewBox="0 0 300 124"
                preserveAspectRatio="none"
                role="img"
                aria-label={t.rhythm}
              >
                <line x1="8" y1="24" x2="296" y2="24" />
                <line x1="8" y1="68" x2="296" y2="68" />
                <line x1="8" y1="112" x2="296" y2="112" />
                <polygon points={`10,112 ${points} 290,112`} />
                <polyline points={points} />
                {weekly.map((value, index) => (
                  <circle
                    key={index}
                    cx={10 + index * 40}
                    cy={112 - (value / maxWeekly) * 88}
                    r="3"
                  />
                ))}
              </svg>
            </div>
            <div className="x-labels">
              <span>{t.weeksAgo8}</span>
              <span>{t.weeks6}</span>
              <span>{t.weeks4}</span>
              <span>{t.weeks2}</span>
              <span>{t.thisWeek}</span>
            </div>
          </article>
          <article className="panel breakdown-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">{t.allActivity}</span>
                <h2>{t.byCategory}</h2>
              </div>
            </div>
            <div className="donut-row">
              <div
                className="donut"
                style={{
                  background: `conic-gradient(${donut || "#e7e8e2 0 360deg"})`,
                }}
              >
                <div>
                  <strong>{formatMoney(categorySum)}</strong>
                  <span>{t.total}</span>
                </div>
              </div>
              <div className="category-list">
                {categoryTotals.slice(0, 4).map((item) => (
                  <div key={item.category}>
                    <i style={{ background: categoryColor(item.category) }} />
                    <span>{categoryLabel(language, item.category)}</span>
                    <b>{Math.round((item.total / categorySum) * 100)}%</b>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="bottom-grid" id="activity">
          <article className="panel activity-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">{t.latest}</span>
                <h2>{t.recent}</h2>
              </div>
              <button
                className="link-button"
                onClick={() => setModal("activity")}
              >
                {t.viewAll} <span>→</span>
              </button>
            </div>
            <div className="transaction-list">
              {visibleTransactions.slice(0, 5).map((item) => {
                const member = data.members.find(
                  (person) => person.id === item.memberId,
                );
                const color = categoryColor(item.category);
                return (
                  <div className="transaction" key={item.id}>
                    <span
                      className="category-icon"
                      style={{ color, background: `${color}18` }}
                    >
                      {categoryIcons[item.category] ?? "•"}
                    </span>
                    <div className="transaction-copy">
                      <b>{item.note}</b>
                      <span>
                        {categoryLabel(language, item.category)} ·{" "}
                        {new Date(item.happenedAt).toLocaleDateString(
                          language === "nl" ? "nl-NL" : "en-GB",
                          { day: "numeric", month: "short" },
                        )}
                        {item.currency !== data.household.baseCurrency
                          ? ` · ${item.currency}`
                          : ""}
                      </span>
                    </div>
                    {item.source === "telegram" && (
                      <span className="source-badge">↗ {t.bot}</span>
                    )}
                    <span
                      className="mini-avatar"
                      title={member?.name}
                      aria-label={member?.name}
                      style={{ background: member?.color }}
                    >
                      {initials(member?.name ?? "?")}
                    </span>
                    <strong className="transaction-amount">
                      −{formatMoney(item.baseAmountCents, 2)}
                    </strong>
                  </div>
                );
              })}
              {visibleTransactions.length === 0 && (
                <div className="empty-state">
                  <span>✦</span>
                  <b>{t.emptyTitle}</b>
                  <p>{t.emptyText}</p>
                </div>
              )}
            </div>
          </article>
          <aside className="side-stack">
            <article className="panel rates-panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">
                    {language === "nl" ? "LIVE KOERSEN" : "LIVE RATES"}
                  </span>
                  <h2>
                    {language === "nl" ? "€1 is gelijk aan" : "€1 equals"}
                  </h2>
                </div>
                <span className="api-badge">
                  {language === "nl" ? "Live gegevens" : "Live data"}
                </span>
              </div>
              <div className="rates">
                {(["USD", "GBP", "CAD"] as Currency[]).map((code) => (
                  <div key={code}>
                    <span>{currencySymbols[code]}</span>
                    <b>
                      {referenceRates?.[code]?.toFixed(3) ??
                        (code === "USD"
                          ? "1.160"
                          : code === "GBP"
                            ? "0.870"
                            : "1.590")}
                    </b>
                    <small>{code}</small>
                  </div>
                ))}
              </div>
              <p>{t.refreshed}</p>
            </article>
            <article className="phase-card">
              <div className="phase-orbit">✦</div>
              <div>
                <span>{t.familySpace}</span>
                <h3>{t.readyGrow}</h3>
                <p>{t.future}</p>
              </div>
            </article>
          </aside>
        </section>

        <button
          className="settings-fab"
          onClick={() => setModal("settings")}
          aria-label={language === "nl" ? "Instellingen" : "Settings"}
        >
          ⚙
        </button>
        <button className="fab" onClick={() => setModal("expense")}>
          <span>＋</span>
          {t.addExpense}
        </button>
      </main>
      {modal === "expense" && (
        <AddExpenseModal
          data={data}
          language={language}
          rates={rates}
          demoMode={isDemo}
          onClose={() => setModal(null)}
          onSaved={(item) =>
            setData((old) => ({
              ...old,
              transactions: [item, ...old.transactions],
              familyBudgetTransactions: [
                {
                  id: item.id,
                  type: item.type,
                  baseAmountCents: item.baseAmountCents,
                  happenedAt: item.happenedAt,
                },
                ...old.familyBudgetTransactions,
              ],
            }))
          }
        />
      )}
      {modal === "invite" && (
        <InviteModal
          language={language}
          data={data}
          demoMode={isDemo}
          onClose={() => setModal(null)}
          onUpdated={setData}
        />
      )}
      {modal === "members" && isOwner && (
        <MemberManagementModal
          language={language}
          data={data}
          demoMode={isDemo}
          onClose={() => setModal(null)}
          onInvite={() => setModal("invite")}
          onUpdated={setData}
        />
      )}
      {modal === "activity" && (
        <ActivityModal
          items={visibleTransactions}
          members={data.members}
          currentMemberId={data.currentMemberId}
          isOwner={isOwner}
          language={language}
          displayCurrency={displayCurrency}
          baseCurrency={data.household.baseCurrency as Currency}
          rates={rates}
          onClose={() => setModal(null)}
          onEdit={(item) => {
            setSelectedTransaction(item);
            setModal("edit");
          }}
        />
      )}
      {modal === "edit" && selectedTransaction && (
        <EditExpenseModal
          item={selectedTransaction}
          data={data}
          language={language}
          demoMode={isDemo}
          onClose={() => {
            setSelectedTransaction(null);
            setModal(null);
          }}
          onUpdated={(item) =>
            setData((old) => ({
              ...old,
              transactions: old.transactions.map((entry) =>
                entry.id === item.id ? item : entry,
              ),
              familyBudgetTransactions: old.familyBudgetTransactions.map(
                (entry) =>
                  entry.id === item.id
                    ? {
                        id: item.id,
                        type: item.type,
                        baseAmountCents: item.baseAmountCents,
                        happenedAt: item.happenedAt,
                      }
                    : entry,
              ),
            }))
          }
          onDeleted={(id) =>
            setData((old) => ({
              ...old,
              transactions: old.transactions.filter((entry) => entry.id !== id),
              familyBudgetTransactions: old.familyBudgetTransactions.filter(
                (entry) => entry.id !== id,
              ),
            }))
          }
        />
      )}
      {modal === "settings" && (
        <SettingsModal
          data={data}
          language={language}
          demoMode={isDemo}
          onClose={() => setModal(null)}
          onUpdated={setData}
        />
      )}
      {modal === "budget" && isOwner && (
        <BudgetAdjustmentModal
          language={language}
          data={data}
          demoMode={isDemo}
          onClose={() => setModal(null)}
          onUpdated={setData}
        />
      )}
      {modal === "budgetSettings" && isOwner && (
        <FamilyBudgetSettingsModal
          language={language}
          data={data}
          demoMode={isDemo}
          onClose={() => setModal(null)}
          onUpdated={(fresh) => {
            setData(fresh);
            setDisplayCurrency(fresh.household.baseCurrency as Currency);
          }}
        />
      )}
    </div>
  );
}
