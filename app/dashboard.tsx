"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoData } from "../lib/demo-data";
import type { DashboardData, Member, MembershipRequest, Transaction } from "../lib/types";

type Language = "en" | "nl";
type Currency = "EUR" | "USD" | "CAD" | "GBP";
type ExternalData = {
  weather: null | {
    current?: { temperature_2m: number; apparent_temperature: number; weather_code: number };
    daily?: { temperature_2m_max: number[]; temperature_2m_min: number[] };
  };
  place?: { name: string; country_code?: string };
  rates?: Record<string, number>;
};

const displayCurrencies: Currency[] = ["EUR", "USD", "CAD", "GBP"];
const currencySymbols: Record<Currency, string> = { EUR: "€", USD: "$", CAD: "C$", GBP: "£" };
const categories = ["Groceries", "Dining", "Transport", "Home", "Health", "Leisure", "Bills", "Other"];
const categoryColors: Record<string, string> = { Groceries: "#1d6b5a", Dining: "#e2764f", Transport: "#e6ae3b", Home: "#6688c0", Health: "#ac78b5", Leisure: "#75a87d", Bills: "#996853", Other: "#a9aaa3" };
const categoryIcons: Record<string, string> = { Groceries: "♧", Dining: "☕", Transport: "↗", Home: "⌂", Health: "+", Leisure: "✦", Bills: "▤", Other: "•" };
const categoryNames: Record<Language, Record<string, string>> = {
  en: { Groceries: "Groceries", Dining: "Dining", Transport: "Transport", Home: "Home", Health: "Health", Leisure: "Leisure", Bills: "Bills", Other: "Other" },
  nl: { Groceries: "Boodschappen", Dining: "Uit eten", Transport: "Vervoer", Home: "Wonen", Health: "Gezondheid", Leisure: "Vrije tijd", Bills: "Rekeningen", Other: "Overig" },
};

const copy: Record<Language, Record<string, string>> = {
  en: {
    overview: "Overview", activity: "Activity", telegram: "Telegram", household: "Household", everyone: "Everyone", combined: "Combined view", you: "You", member: "Member", invite: "Invite family member", telegramBot: "Telegram bot", exitTest: "Exit test mode", trySample: "Try sample data",
    greeting: "Good afternoon, family.", hello: "Hello", subtitle: "Here’s how life at home is looking.", testDrive: "Test drive", test: "Test", live: "Live", sampleData: "sample data", justNow: "just now", syncing: "syncing", testMode: "Test mode", testMessage: "These sample entries are temporary. Add expenses, switch members and explore every chart.",
    spentMonth: "Spent this month", freshMonth: "A fresh month", fromLastMonth: "from last month", dailyAverage: "Daily average", across: "across", people: "people", thisMember: "this member", topCategory: "Top category", nothingYet: "Nothing yet", firstEntry: "Your first entry will appear here",
    last8: "Last 8 weeks", rhythm: "Spending rhythm", selectedMember: "Selected member", weeksAgo8: "8 weeks ago", weeks6: "6 weeks", weeks4: "4 weeks", weeks2: "2 weeks", thisWeek: "This week", allActivity: "All activity", byCategory: "By category", latest: "Latest", recent: "Recent activity", viewAll: "View all", bot: "Bot", emptyTitle: "Your story starts here", emptyText: "Add the first expense and this space will come alive.",
    rates: "Rates", oneEuro: "€1", total: "Total", refreshed: "Reference rates · refreshed automatically", familySpace: "Your family space", readyGrow: "Ready to grow with you.", future: "Budgets, reminders, shared events and smarter inputs can be added whenever your household needs them.", addExpense: "Add expense", displayCurrency: "Display currency", language: "Language",
    newEntry: "New entry", amount: "Amount", category: "Category", whatFor: "What was it for?", example: "e.g. Weekly groceries", cancel: "Cancel", saving: "Saving…", householdLedger: "Household ledger", close: "Close", entered: "entered",
    yourHousehold: "Your household", inviteTitle: "Invite a family member", inviteHelp: "Their sign-in email connects them to this shared household while keeping their personal view separate.", name: "Name", email: "Email", adding: "Adding…", addHousehold: "Add to household",
    manageMembers: "Manage members", memberChanges: "Member changes", activeMembers: "Active members", pendingChanges: "Pending approvals", noPending: "No changes are waiting for approval.", remove: "Remove", removing: "Requesting…", approve: "Approve", approving: "Approving…", approvedByYou: "Approved by you", requestedBy: "Requested by", addRequest: "Add member", removeRequest: "Remove member", approvals: "approvals", approvalHelp: "Adding needs approval from the existing household. Removing needs every remaining member to approve.", requestSubmitted: "Request submitted", addAnother: "Invite member", nameMustBeUnique: "Each active member needs a unique name.", copyTelegram: "Copy Telegram link", copiedTelegram: "Link copied",
    fastCapture: "Fast capture", logTelegram: "Log from Telegram", connected: "Permanent secure Telegram delivery is active.", notConnected: "This workflow is available after the family bot is connected.", openBot: "Generate a private one-time link, then send it to the family bot within 24 hours.", logLine: "Then tap Add expense, choose a category and send only the amount:", copied: "Copied", copy: "Generate & copy", botAuto: "Telegram entries arrive automatically, even when the dashboard is closed.", botPreview: "Permanent Telegram delivery still needs to be enabled.", activateBot: "Enable permanent delivery", activatingBot: "Enabling…", secretsMissing: "Telegram secrets still need to be added on the host.", ownerActivates: "The household owner needs to enable Telegram delivery.", syncNow: "Sync now", syncingTelegram: "Syncing…",
    clear: "Clear", cloudy: "Partly cloudy", rain: "Rain", snow: "Snow", showers: "Showers", feels: "Feels like", high: "H", low: "L",
  },
  nl: {
    overview: "Overzicht", activity: "Activiteit", telegram: "Telegram", household: "Huishouden", everyone: "Iedereen", combined: "Gezamenlijk overzicht", you: "Jij", member: "Lid", invite: "Gezinslid uitnodigen", telegramBot: "Telegram-bot", exitTest: "Testmodus afsluiten", trySample: "Voorbeeldgegevens",
    greeting: "Goedemiddag, familie.", hello: "Hallo", subtitle: "Zo ziet het leven thuis er vandaag uit.", testDrive: "Testen", test: "Test", live: "Live", sampleData: "voorbeeldgegevens", justNow: "zojuist", syncing: "synchroniseren", testMode: "Testmodus", testMessage: "Deze voorbeeldgegevens zijn tijdelijk. Voeg uitgaven toe, wissel van gezinslid en bekijk alle grafieken.",
    spentMonth: "Uitgegeven deze maand", freshMonth: "Een nieuwe maand", fromLastMonth: "ten opzichte van vorige maand", dailyAverage: "Dagelijks gemiddelde", across: "verdeeld over", people: "personen", thisMember: "dit gezinslid", topCategory: "Grootste categorie", nothingYet: "Nog niets", firstEntry: "Je eerste uitgave verschijnt hier",
    last8: "Laatste 8 weken", rhythm: "Uitgavenritme", selectedMember: "Geselecteerd gezinslid", weeksAgo8: "8 weken geleden", weeks6: "6 weken", weeks4: "4 weken", weeks2: "2 weken", thisWeek: "Deze week", allActivity: "Alle activiteit", byCategory: "Per categorie", latest: "Recent", recent: "Recente activiteit", viewAll: "Alles bekijken", bot: "Bot", emptyTitle: "Je verhaal begint hier", emptyText: "Voeg de eerste uitgave toe en dit overzicht komt tot leven.",
    rates: "Koersen", oneEuro: "€1", total: "Totaal", refreshed: "Referentiekoersen · automatisch vernieuwd", familySpace: "Jullie gezinsruimte", readyGrow: "Klaar om mee te groeien.", future: "Budgetten, herinneringen, gedeelde afspraken en slimmere invoer kunnen later worden toegevoegd.", addExpense: "Uitgave toevoegen", displayCurrency: "Weergavevaluta", language: "Taal",
    newEntry: "Nieuwe invoer", amount: "Bedrag", category: "Categorie", whatFor: "Waar was het voor?", example: "bijv. Weekboodschappen", cancel: "Annuleren", saving: "Opslaan…", householdLedger: "Huishoudboek", close: "Sluiten", entered: "ingevoerd",
    yourHousehold: "Jouw huishouden", inviteTitle: "Gezinslid uitnodigen", inviteHelp: "Het e-mailadres waarmee diegene inlogt wordt aan dit huishouden gekoppeld, met een eigen persoonlijk overzicht.", name: "Naam", email: "E-mail", adding: "Toevoegen…", addHousehold: "Toevoegen aan huishouden",
    manageMembers: "Leden beheren", memberChanges: "Wijzigingen in leden", activeMembers: "Actieve leden", pendingChanges: "Wacht op goedkeuring", noPending: "Er wachten geen wijzigingen op goedkeuring.", remove: "Verwijderen", removing: "Aanvragen…", approve: "Goedkeuren", approving: "Goedkeuren…", approvedByYou: "Door jou goedgekeurd", requestedBy: "Aangevraagd door", addRequest: "Lid toevoegen", removeRequest: "Lid verwijderen", approvals: "goedkeuringen", approvalHelp: "Toevoegen vereist goedkeuring van het bestaande huishouden. Verwijderen vereist goedkeuring van alle overblijvende leden.", requestSubmitted: "Aanvraag ingediend", addAnother: "Lid uitnodigen", nameMustBeUnique: "Elk actief lid moet een unieke naam hebben.", copyTelegram: "Telegram-link kopiëren", copiedTelegram: "Link gekopieerd",
    fastCapture: "Snel invoeren", logTelegram: "Invoeren via Telegram", connected: "Permanente beveiligde Telegram-bezorging is actief.", notConnected: "Deze functie is beschikbaar nadat de gezinsbot is gekoppeld.", openBot: "Maak een persoonlijke eenmalige link en stuur die binnen 24 uur naar de gezinsbot.", logLine: "Tik daarna op Uitgave toevoegen, kies een categorie en stuur alleen het bedrag:", copied: "Gekopieerd", copy: "Maken en kopiëren", botAuto: "Telegram-uitgaven komen automatisch binnen, ook als het dashboard gesloten is.", botPreview: "Permanente Telegram-bezorging moet nog worden ingeschakeld.", activateBot: "Permanente bezorging inschakelen", activatingBot: "Inschakelen…", secretsMissing: "De Telegram-secrets moeten nog op de host worden ingesteld.", ownerActivates: "De eigenaar van het huishouden moet Telegram-bezorging inschakelen.", syncNow: "Nu synchroniseren", syncingTelegram: "Synchroniseren…",
    clear: "Helder", cloudy: "Halfbewolkt", rain: "Regen", snow: "Sneeuw", showers: "Buien", feels: "Voelt als", high: "H", low: "L",
  },
};

function clientId() { return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return; }
  } catch { /* Fall through for browsers that block the Clipboard API. */ }
  const field = document.createElement("textarea");
  field.value = value; field.style.position = "fixed"; field.style.opacity = "0";
  document.body.appendChild(field); field.select(); document.execCommand("copy"); field.remove();
}
function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function categoryLabel(language: Language, category: string) { return categoryNames[language][category] ?? category; }
function categoryColor(category: string) { return categoryColors[category] ?? "#71877f"; }
function monthKey(date: Date) { return `${date.getFullYear()}-${date.getMonth()}`; }
function convertedCents(baseCents: number, currency: Currency, rates?: Record<string, number>) { return Math.round(baseCents * (currency === "EUR" ? 1 : rates?.[currency] ?? 1)); }
function money(baseCents: number, currency: Currency, rates: Record<string, number> | undefined, language: Language, digits = 0) {
  return new Intl.NumberFormat(language === "nl" ? "nl-NL" : "en-NL", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(convertedCents(baseCents, currency, rates) / 100);
}
function weatherLabel(code: number | undefined, language: Language) {
  const t = copy[language];
  if (!code) return { icon: "☀", label: t.clear };
  if (code <= 3) return { icon: "☁", label: t.cloudy };
  if (code <= 67) return { icon: "☂", label: t.rain };
  if (code <= 77) return { icon: "❄", label: t.snow };
  return { icon: "ϟ", label: t.showers };
}

function Modal({ title, eyebrow, closeLabel, onClose, children }: { title: string; eyebrow: string; closeLabel: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="eyebrow">{eyebrow}</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label={closeLabel}>×</button></div>{children}</section></div>;
}

function AddExpenseModal({ data, language, rates, demoMode, onClose, onSaved }: { data: DashboardData; language: Language; rates?: Record<string, number>; demoMode: boolean; onClose: () => void; onSaved: (item: Transaction) => void }) {
  const t = copy[language];
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [category, setCategory] = useState("Groceries");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const numericAmount = Number(amount);
    const eurRate = currency === "EUR" ? 1 : 1 / (rates?.[currency] ?? 1);
    const draft: Transaction = { id: clientId(), memberId: data.currentMemberId, amountCents: Math.round(numericAmount * 100), baseAmountCents: Math.round(numericAmount * eurRate * 100), currency, category, note: note || categoryLabel(language, category), type: "expense", source: "web", happenedAt: new Date().toISOString() };
    if (demoMode) { onSaved(draft); onClose(); return; }
    try {
      const response = await fetch("/api/dashboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "addTransaction", amount, category, note, currency, eurRate }) });
      if (!response.ok) throw new Error((await response.json()).error || "Could not save");
      onSaved(((await response.json()) as { transaction: Transaction }).transaction); onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save");
    } finally { setSaving(false); }
  }

  const availableCategories = [...categories, ...data.categories.map((item) => item.name)];
  return <Modal eyebrow={t.newEntry} title={t.addExpense} closeLabel={t.close} onClose={onClose}><form onSubmit={submit} className="expense-form"><label className="amount-field"><span>{t.amount}</span><div><b>{currencySymbols[currency]}</b><input autoFocus inputMode="decimal" required min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /><select className="currency-select" aria-label={t.displayCurrency} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>{displayCurrencies.map((item) => <option key={item}>{item}</option>)}</select></div></label><label><span>{t.category}</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{availableCategories.map((item) => <option key={item} value={item}>{categoryLabel(language, item)}</option>)}</select></label><label><span>{t.whatFor}</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.example} /></label>{error && <p className="form-error">{error}</p>}<div className="entry-owner"><span className="avatar" style={{ background: data.members.find((m) => m.id === data.currentMemberId)?.color }}>{initials(data.members.find((m) => m.id === data.currentMemberId)?.name ?? "Me")}</span><span>{data.members.find((m) => m.id === data.currentMemberId)?.name}</span></div><div className="modal-actions"><button type="button" className="text-button" onClick={onClose}>{t.cancel}</button><button className="primary-button" disabled={saving}>{saving ? t.saving : t.addExpense}</button></div></form></Modal>;
}

function InviteModal({ language, data, demoMode, onClose, onUpdated }: { language: Language; data: DashboardData; demoMode: boolean; onClose: () => void; onUpdated: (data: DashboardData) => void }) {
  const t = copy[language]; const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const normalized = name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    if (data.members.some((member) => member.status === "active" && member.name.trim().replace(/\s+/g, " ").toLocaleLowerCase() === normalized)) { setError(t.nameMustBeUnique); setSaving(false); return; }
    if (demoMode) {
      onUpdated({ ...data, members: [...data.members, { id: clientId(), name: name.trim(), email: email.trim().toLowerCase(), color: "#8b6ccf", role: "member", status: "active", telegramLinkCode: "TEST12" }] });
      onClose(); setSaving(false); return;
    }
    try {
      const response = await fetch("/api/dashboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "requestAddMember", name, email }) });
      const result = await response.json() as DashboardData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not request a new member");
      onUpdated(result); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not request a new member"); } finally { setSaving(false); }
  }
  return <Modal eyebrow={t.yourHousehold} title={t.inviteTitle} closeLabel={t.close} onClose={onClose}><p className="modal-copy">{t.inviteHelp} {t.nameMustBeUnique}</p><form onSubmit={submit} className="expense-form"><div className="form-grid"><label><span>{t.name}</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mohammad" /></label><label><span>{t.email}</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" /></label></div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="text-button" onClick={onClose}>{t.cancel}</button><button className="primary-button" disabled={saving}>{saving ? t.adding : t.addHousehold}</button></div></form></Modal>;
}

function EditExpenseModal({ item, data, language, demoMode, onClose, onUpdated, onDeleted }: { item: Transaction; data: DashboardData; language: Language; demoMode: boolean; onClose: () => void; onUpdated: (item: Transaction) => void; onDeleted: (id: string) => void }) {
  const t = copy[language];
  const [amount, setAmount] = useState((item.amountCents / 100).toFixed(2));
  const [category, setCategory] = useState(item.category);
  const [note, setNote] = useState(item.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const availableCategories = [...categories, ...data.categories.map((entry) => entry.name)];
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    if (demoMode) { onUpdated({ ...item, amountCents: Math.round(Number(amount) * 100), baseAmountCents: Math.round(Number(amount) * 100), category, note: note || category }); onClose(); return; }
    try {
      const response = await fetch("/api/dashboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "updateTransaction", transactionId: item.id, amount, category, note }) });
      const result = await response.json() as { transaction?: Transaction; error?: string };
      if (!response.ok || !result.transaction) throw new Error(result.error || "Could not update expense");
      onUpdated(result.transaction); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update expense"); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(language === "nl" ? "Deze uitgave verwijderen?" : "Delete this expense?")) return;
    setBusy(true); setError("");
    if (demoMode) { onDeleted(item.id); onClose(); return; }
    try {
      const response = await fetch("/api/dashboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "deleteTransaction", transactionId: item.id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not delete expense");
      onDeleted(item.id); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not delete expense"); } finally { setBusy(false); }
  }
  return <Modal eyebrow={t.householdLedger} title={language === "nl" ? "Uitgave bewerken" : "Edit expense"} closeLabel={t.close} onClose={onClose}><form className="expense-form" onSubmit={save}><label className="amount-field"><span>{t.amount} · {item.currency}</span><div><b>{currencySymbols[item.currency as Currency] ?? item.currency}</b><input autoFocus inputMode="decimal" required min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div></label><label><span>{t.category}</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{availableCategories.map((entry) => <option key={entry}>{categoryLabel(language, entry)}</option>)}</select></label><label><span>{t.whatFor}</span><input maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions split-actions"><button type="button" className="danger-button" disabled={busy} onClick={remove}>{language === "nl" ? "Verwijderen" : "Delete"}</button><span /><button type="button" className="text-button" onClick={onClose}>{t.cancel}</button><button className="primary-button" disabled={busy}>{busy ? t.saving : language === "nl" ? "Opslaan" : "Save changes"}</button></div></form></Modal>;
}

function SettingsModal({ data, language, demoMode, onClose, onUpdated }: { data: DashboardData; language: Language; demoMode: boolean; onClose: () => void; onUpdated: (data: DashboardData) => void }) {
  const t = copy[language]; const [name, setName] = useState(""); const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  async function categoryAction(action: "addCategory" | "archiveCategory", value: string) {
    setBusy(value); setError("");
    if (demoMode) {
      onUpdated(action === "addCategory" ? { ...data, categories: [...data.categories, { id: clientId(), name: value }] } : { ...data, categories: data.categories.filter((item) => item.id !== value) });
      setName(""); setBusy(""); return;
    }
    try {
      const response = await fetch("/api/dashboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action === "addCategory" ? { action, name: value } : { action, categoryId: value }) });
      const result = await response.json() as DashboardData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not update categories");
      onUpdated(result); setName("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update categories"); } finally { setBusy(""); }
  }
  return <Modal eyebrow={language === "nl" ? "HUISHOUDEN" : "HOUSEHOLD"} title={language === "nl" ? "Instellingen en gegevens" : "Settings & data"} closeLabel={t.close} onClose={onClose}><div className="settings-grid"><section className="settings-section"><h3>{language === "nl" ? "Eigen categorieën" : "Custom categories"}</h3><p>{language === "nl" ? "Deze categorieën verschijnen op de website en in Telegram." : "These categories appear on the website and in Telegram."}</p><form className="category-create" onSubmit={(event) => { event.preventDefault(); if (name.trim()) categoryAction("addCategory", name.trim()); }}><input minLength={2} maxLength={30} required value={name} onChange={(event) => setName(event.target.value)} placeholder={language === "nl" ? "bijv. Huisdieren" : "e.g. Pets"} /><button className="primary-button compact" disabled={Boolean(busy)}>＋ {language === "nl" ? "Toevoegen" : "Add"}</button></form><div className="category-manager">{data.categories.length ? data.categories.map((item) => <div key={item.id}><span style={{ background: categoryColor(item.name) }}>•</span><b>{item.name}</b><button className="danger-button" disabled={busy === item.id} onClick={() => categoryAction("archiveCategory", item.id)}>{language === "nl" ? "Archiveren" : "Archive"}</button></div>) : <p>{language === "nl" ? "Nog geen eigen categorieën." : "No custom categories yet."}</p>}</div></section><section className="settings-section"><h3>{language === "nl" ? "Export en back-up" : "Export & backup"}</h3><p>{language === "nl" ? "Download een draagbare kopie van jullie gegevens." : "Download a portable copy of your household data."}</p><div className="export-actions"><a className="primary-button" href="/api/export?format=csv">CSV</a><a className="text-button export-link" href="/api/export?format=json">JSON backup</a></div></section><section className="settings-section audit-section"><h3>{language === "nl" ? "Recente beveiligingsactiviteit" : "Recent security activity"}</h3><div className="audit-list">{data.auditLogs.length ? data.auditLogs.map((item) => <div key={item.id}><span>✓</span><p><b>{item.summary}</b><small>{item.actorName} · {new Date(item.createdAt).toLocaleString(language === "nl" ? "nl-NL" : "en-GB")}</small></p></div>) : <p>{language === "nl" ? "Nog geen activiteit." : "No activity recorded yet."}</p>}</div></section></div>{error && <p className="form-error">{error}</p>}</Modal>;
}

function MemberManagementModal({ language, data, demoMode, onClose, onInvite, onUpdated }: { language: Language; data: DashboardData; demoMode: boolean; onClose: () => void; onInvite: () => void; onUpdated: (data: DashboardData) => void }) {
  const t = copy[language]; const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [copiedMember, setCopiedMember] = useState("");
  const active = data.members.filter((member) => member.status === "active");
  async function change(action: "requestRemoveMember" | "approveMembershipRequest", id: string) {
    setBusy(id); setError("");
    if (demoMode && action === "requestRemoveMember") {
      onUpdated({ ...data, members: data.members.map((member) => member.id === id ? { ...member, status: "removed" as const } : member) }); setBusy(""); return;
    }
    try {
      const response = await fetch("/api/dashboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action === "requestRemoveMember" ? { action, targetMemberId: id } : { action, requestId: id }) });
      const result = await response.json() as DashboardData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not update members");
      onUpdated(result);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update members"); } finally { setBusy(""); }
  }
  async function copyMemberLink(member: Member) {
    setBusy(member.id); setError("");
    try {
      let linkCode = member.telegramLinkCode;
      if (!demoMode) {
        const response = await fetch("/api/dashboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "rotateTelegramLink", targetMemberId: member.id }) });
        const result = await response.json() as DashboardData & { error?: string };
        if (!response.ok) throw new Error(result.error || "Could not create Telegram link");
        onUpdated(result); linkCode = result.members.find((item) => item.id === member.id)?.telegramLinkCode ?? linkCode;
      }
      await copyText(`/link ${linkCode}`); setCopiedMember(member.id); window.setTimeout(() => setCopiedMember(""), 1600);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create Telegram link"); } finally { setBusy(""); }
  }
  const owner = data.members.find((member) => member.id === data.currentMemberId)?.role === "owner";
  return <Modal eyebrow={t.yourHousehold} title={t.manageMembers} closeLabel={t.close} onClose={onClose}><p className="modal-copy">{t.approvalHelp}</p><div className="member-section"><div className="member-section-head"><span>{t.activeMembers}</span><button className="text-button compact" onClick={onInvite}>＋ {t.addAnother}</button></div>{active.map((member) => <div className="member-row" key={member.id}><span className="avatar" style={{ background: member.color }}>{initials(member.name)}</span><div><b>{member.name}</b><small>{member.email} · {member.id === data.currentMemberId ? t.you : t.member}</small></div><div className="member-row-actions">{owner && <button className="telegram-link-button" onClick={() => copyMemberLink(member)}>{copiedMember === member.id ? `✓ ${t.copiedTelegram}` : `↗ ${t.copyTelegram}`}</button>}{member.id !== data.currentMemberId && <button className="danger-button" disabled={busy === member.id} onClick={() => change("requestRemoveMember", member.id)}>{busy === member.id ? t.removing : t.remove}</button>}</div></div>)}</div><div className="member-section"><div className="member-section-head"><span>{t.pendingChanges}</span><em>{data.membershipRequests.length}</em></div>{data.membershipRequests.length === 0 ? <p className="empty-approval">{t.noPending}</p> : data.membershipRequests.map((request: MembershipRequest) => <div className="approval-card" key={request.id}><div className={`request-icon ${request.action}`}>{request.action === "add" ? "+" : "−"}</div><div><b>{request.action === "add" ? t.addRequest : t.removeRequest}: {request.targetName}</b><small>{t.requestedBy} {request.requestedByName} · {request.approvals}/{request.requiredApprovals} {t.approvals}</small></div>{request.currentMemberApproved ? <span className="approved-label">✓ {t.approvedByYou}</span> : request.canApprove && <button className="primary-button compact" disabled={busy === request.id} onClick={() => change("approveMembershipRequest", request.id)}>{busy === request.id ? t.approving : t.approve}</button>}</div>)}</div>{error && <p className="form-error">{error}</p>}</Modal>;
}

function TelegramPanel({ current, configured, ready, language, onActivated, onUpdated }: { current: Member; configured: boolean; ready: boolean; language: Language; onActivated: () => void; onUpdated: (data: DashboardData) => void }) {
  const t = copy[language]; const [copied, setCopied] = useState(false); const [activating, setActivating] = useState(false); const [error, setError] = useState("");
  async function copyCode() { try { const response = await fetch("/api/dashboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "rotateTelegramLink", targetMemberId: current.id }) }); const result = await response.json() as DashboardData & { error?: string }; if (!response.ok) throw new Error(result.error || "Could not create Telegram link"); onUpdated(result); const next = result.members.find((item) => item.id === current.id)?.telegramLinkCode; if (!next) throw new Error("Could not create Telegram link"); await copyText(`/link ${next}`); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch (err) { setError(err instanceof Error ? err.message : "Could not create Telegram link"); } }
  async function activate() { setActivating(true); setError(""); try { const response = await fetch("/api/telegram/setup", { method: "POST" }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Could not activate Telegram"); onActivated(); } catch (err) { setError(err instanceof Error ? err.message : "Could not activate Telegram"); } finally { setActivating(false); } }
  return <div className="telegram-panel"><div className="telegram-mark">↗</div><div><span className="eyebrow">{t.fastCapture}</span><h3>{t.logTelegram}</h3><p>{ready ? t.connected : configured ? t.botPreview : t.secretsMissing}</p>{configured && !ready && current.role === "owner" && <button className="activate-bot" disabled={activating} onClick={activate}>{activating ? t.activatingBot : t.activateBot}</button>}{configured && !ready && current.role !== "owner" && <p className="tiny-note">{t.ownerActivates}</p>}{error && <p className="form-error">{error}</p>}</div><div className="telegram-steps"><span>1</span><p>{t.openBot}</p><button onClick={copyCode} className="code-pill"><code>/link ••••••••</code><b>{copied ? t.copied : t.copy}</b></button><span>2</span><p>{t.logLine}</p><div className="message-example">24.50</div></div><p className="tiny-note">{ready ? t.botAuto : t.botPreview}</p></div>;
}

function ActivityModal({ items, members, currentMemberId, language, displayCurrency, rates, onClose, onEdit }: { items: Transaction[]; members: Member[]; currentMemberId: string; language: Language; displayCurrency: Currency; rates?: Record<string, number>; onClose: () => void; onEdit: (item: Transaction) => void }) {
  const t = copy[language];
  return <Modal eyebrow={t.householdLedger} title={t.allActivity} closeLabel={t.close} onClose={onClose}><div className="all-activity-list">{items.map((item) => { const member = members.find((m) => m.id === item.memberId); const color = categoryColor(item.category); return <div className="transaction" key={item.id}><span className="category-icon" style={{ color, background: `${color}18` }}>{categoryIcons[item.category] ?? "•"}</span><div className="transaction-copy"><b>{item.note}</b><span>{categoryLabel(language, item.category)} · {member?.name} · {new Date(item.happenedAt).toLocaleDateString(language === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}{item.currency !== "EUR" ? ` · ${currencySymbols[item.currency as Currency] ?? item.currency}${(item.amountCents / 100).toFixed(2)} ${t.entered}` : ""}</span></div>{item.memberId === currentMemberId && <button className="edit-transaction" onClick={() => onEdit(item)}>{language === "nl" ? "Bewerken" : "Edit"}</button>}<span className="mini-avatar" title={member?.name} aria-label={member?.name} style={{ background: member?.color }}>{initials(member?.name ?? "?")}</span><strong className="transaction-amount">−{money(item.baseAmountCents, displayCurrency, rates, language, 2)}</strong></div>; })}</div></Modal>;
}

export default function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData); const [scope, setScope] = useState("family"); const [external, setExternal] = useState<ExternalData | null>(null); const [modal, setModal] = useState<"expense" | "edit" | "invite" | "members" | "activity" | "settings" | null>(null); const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null); const [showTelegram, setShowTelegram] = useState(false); const [dark, setDark] = useState(false); const [isDemo, setIsDemo] = useState(true); const [lastSync, setLastSync] = useState(0); const [botStatus, setBotStatus] = useState({ configured: false, webhookReady: false }); const [language, setLanguage] = useState<Language>("en"); const [displayCurrency, setDisplayCurrency] = useState<Currency>("EUR"); const testModeRef = useRef(false);
  const t = copy[language]; const rates = external?.rates;
  const formatMoney = useCallback((cents: number, digits = 0) => money(cents, displayCurrency, rates, language, digits), [displayCurrency, rates, language]);

  const refresh = useCallback(async () => { if (testModeRef.current) return; try { const response = await fetch("/api/dashboard", { cache: "no-store" }); if (!response.ok) return; const fresh = (await response.json()) as DashboardData; if (fresh?.household && fresh?.members) { setData(fresh); setIsDemo(false); setLastSync(Date.now()); } } catch { /* sample view remains available */ } }, []);
  useEffect(() => { const first = window.setTimeout(refresh, 0); const timer = window.setInterval(refresh, 15000); return () => { window.clearTimeout(first); window.clearInterval(timer); }; }, [refresh]);
  useEffect(() => { fetch(`/api/external?city=${encodeURIComponent(data.household.city)}`).then((r) => r.json()).then(setExternal).catch(() => null); }, [data.household.city]);
  const refreshBotStatus = useCallback(() => { fetch("/api/telegram").then((r) => r.json()).then((result: { configured?: boolean; webhookReady?: boolean }) => setBotStatus({ configured: Boolean(result.configured), webhookReady: Boolean(result.webhookReady) })).catch(() => null); }, []);
  useEffect(() => { refreshBotStatus(); }, [refreshBotStatus]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; document.documentElement.lang = language; }, [dark, language]);

  function enterTestMode() { testModeRef.current = true; setData(demoData); setScope("family"); setIsDemo(true); setShowTelegram(false); }
  function exitTestMode() { testModeRef.current = false; setIsDemo(false); setScope("family"); refresh(); }
  function scrollTo(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }

  const visibleTransactions = useMemo(() => data.transactions.filter((item) => scope === "family" || item.memberId === scope), [data.transactions, scope]);
  const now = new Date(); const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentTotal = visibleTransactions.filter((item) => monthKey(new Date(item.happenedAt)) === monthKey(now) && item.type === "expense").reduce((sum, item) => sum + item.baseAmountCents, 0);
  const previousTotal = visibleTransactions.filter((item) => monthKey(new Date(item.happenedAt)) === monthKey(previous) && item.type === "expense").reduce((sum, item) => sum + item.baseAmountCents, 0);
  const change = previousTotal ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100) : 0;
  const activeMembers = data.members.filter((member) => member.status === "active");
  const currentMember = activeMembers.find((member) => member.id === data.currentMemberId) ?? activeMembers[0];
  const allCategoryNames = Array.from(new Set([...categories, ...data.categories.map((item) => item.name), ...visibleTransactions.map((item) => item.category)]));
  const categoryTotals = allCategoryNames.map((category) => ({ category, total: visibleTransactions.filter((item) => item.category === category && item.type === "expense").reduce((sum, item) => sum + item.baseAmountCents, 0) })).filter((item) => item.total > 0).sort((a, b) => b.total - a.total);
  const categorySum = categoryTotals.reduce((sum, item) => sum + item.total, 0) || 1;
  const donut = categoryTotals.map((item, index) => { const start = categoryTotals.slice(0, index).reduce((sum, prior) => sum + (prior.total / categorySum) * 360, 0); const end = start + (item.total / categorySum) * 360; return `${categoryColor(item.category)} ${start}deg ${end}deg`; }).join(", ");
  const weekly = Array.from({ length: 8 }, (_, index) => { const end = new Date(); end.setDate(end.getDate() - (7 - index) * 7); const start = new Date(end); start.setDate(end.getDate() - 6); return visibleTransactions.filter((item) => { const date = new Date(item.happenedAt); return date >= start && date <= end && item.type === "expense"; }).reduce((sum, item) => sum + item.baseAmountCents, 0) / 100; });
  const maxWeekly = Math.max(...weekly, 1); const points = weekly.map((value, index) => `${10 + index * 40},${112 - (value / maxWeekly) * 88}`).join(" "); const weather = weatherLabel(external?.weather?.current?.weather_code, language);

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">F</div><div><strong>Family Expenses</strong><span>Your household, beautifully organized</span></div></div><nav aria-label="Primary"><button className="nav-item active" onClick={() => scrollTo("overview")}><span>⌂</span>{t.overview}</button><button className="nav-item" onClick={() => scrollTo("activity")}><span>↕</span>{t.activity}</button><button className="nav-item" onClick={() => setShowTelegram((value) => !value)}><span>↗</span>{t.telegram}</button></nav><div className="side-label">{t.household.toUpperCase()}</div><div className="scope-list"><button className={scope === "family" ? "scope active" : "scope"} onClick={() => setScope("family")}><span className="family-avatar">∞</span><div><b>{t.everyone}</b><small>{t.combined}</small></div><em>{formatMoney(data.transactions.reduce((sum, item) => sum + (item.type === "expense" ? item.baseAmountCents : 0), 0))}</em></button>{activeMembers.map((member) => <button key={member.id} className={scope === member.id ? "scope active" : "scope"} onClick={() => setScope(member.id)}><span className="avatar" style={{ background: member.color }}>{initials(member.name)}</span><div><b>{member.name}</b><small>{member.id === data.currentMemberId ? t.you : t.member}</small></div><em>{formatMoney(data.transactions.filter((item) => item.memberId === member.id && item.type === "expense").reduce((sum, item) => sum + item.baseAmountCents, 0))}</em></button>)}</div><button className="invite-button" onClick={() => setModal("invite")}>＋ {t.invite}</button><button className="manage-button" onClick={() => setModal("members")}>⚙ {t.manageMembers}{data.membershipRequests.length > 0 && <i>{data.membershipRequests.length}</i>}</button><div className="sidebar-bottom"><button onClick={() => setShowTelegram((value) => !value)}><span>↗</span>{t.telegramBot}<i className={botStatus.webhookReady ? "status-dot ready" : "status-dot"} /></button><button onClick={isDemo ? exitTestMode : enterTestMode}><span>◌</span>{isDemo ? t.exitTest : t.trySample}</button></div></aside>

    <main className="dashboard-main" id="overview"><header className="topbar"><div><p className="date-line">{now.toLocaleDateString(language === "nl" ? "nl-NL" : "en-GB", { weekday: "long", day: "numeric", month: "long" })}</p><h1>{scope === "family" ? t.greeting : `${t.hello}, ${data.members.find((member) => member.id === scope)?.name}.`}</h1><p>{t.subtitle}</p></div><div className="top-actions"><label className="header-select"><span>{t.language}</span><select aria-label={t.language} value={language} onChange={(e) => setLanguage(e.target.value as Language)}><option value="en">EN</option><option value="nl">NL</option></select></label><label className="header-select currency"><span>{t.displayCurrency}</span><select aria-label={t.displayCurrency} value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value as Currency)}>{displayCurrencies.map((item) => <option key={item}>{item}</option>)}</select></label>{!isDemo && <button className="test-button" onClick={enterTestMode}>◌ {t.testDrive}</button>}<div className="live-chip"><i /><span>{isDemo ? t.test : t.live}</span><small>{isDemo ? t.sampleData : lastSync ? t.justNow : t.syncing}</small></div><button className="theme-button" onClick={() => setDark((value) => !value)} aria-label="Theme">{dark ? "☀" : "☾"}</button><button className="avatar top-avatar" style={{ background: currentMember?.color }} onClick={() => setModal("members")} aria-label={t.manageMembers}>{initials(currentMember?.name ?? "Me")}</button></div></header>

      {isDemo && <div className="demo-banner"><span>{t.testMode}</span>{t.testMessage}<button onClick={exitTestMode}>{t.exitTest}</button></div>}{showTelegram && currentMember && <TelegramPanel current={currentMember} configured={botStatus.configured} ready={botStatus.webhookReady} language={language} onActivated={() => { refreshBotStatus(); refresh(); }} onUpdated={setData} />}

      <section className="metric-grid"><article className="metric hero-metric"><div className="metric-top"><span>{t.spentMonth}</span><i>↗</i></div><strong>{formatMoney(currentTotal)}</strong><p className={change > 0 ? "up" : "down"}>{change === 0 ? t.freshMonth : `${change > 0 ? "↑" : "↓"} ${Math.abs(change)}% ${t.fromLastMonth}`}</p><div className="sparkbars">{[31,48,37,66,52,79,58,92,73,85,62,96].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></article><article className="metric"><div className="metric-top"><span>{t.dailyAverage}</span><i>○</i></div><strong>{formatMoney(currentTotal / Math.max(now.getDate(), 1))}</strong><p>{scope === "family" ? `${t.across} ${activeMembers.length} ${t.people}` : t.thisMember}</p><div className="member-strips">{activeMembers.slice(0, 3).map((member) => <span key={member.id} style={{ background: member.color }} />)}</div></article><article className="metric"><div className="metric-top"><span>{t.topCategory}</span><i>{categoryIcons[categoryTotals[0]?.category] ?? "•"}</i></div><strong className="category-title">{categoryTotals[0] ? categoryLabel(language, categoryTotals[0].category) : t.nothingYet}</strong><p>{categoryTotals[0] ? `${formatMoney(categoryTotals[0].total)} · ${Math.round((categoryTotals[0].total / categorySum) * 100)}%` : t.firstEntry}</p><div className="progress"><i style={{ width: `${categoryTotals[0] ? (categoryTotals[0].total / categorySum) * 100 : 0}%` }} /></div></article><article className="metric weather-card"><div><div className="metric-top"><span>{external?.place?.name?.toUpperCase() ?? data.household.city.toUpperCase()}</span><i>{weather.icon}</i></div><strong>{Math.round(external?.weather?.current?.temperature_2m ?? 21)}°</strong><p>{weather.label} · {t.feels} {Math.round(external?.weather?.current?.apparent_temperature ?? 20)}°</p></div><div className="weather-range"><span>{t.high} {Math.round(external?.weather?.daily?.temperature_2m_max?.[0] ?? 24)}°</span><span>{t.low} {Math.round(external?.weather?.daily?.temperature_2m_min?.[0] ?? 15)}°</span></div></article></section>

      <section className="content-grid"><article className="panel trend-panel"><div className="panel-head"><div><span className="eyebrow">{t.last8}</span><h2>{t.rhythm}</h2></div><div className="legend">{scope === "family" ? activeMembers.map((member) => <span key={member.id}><i style={{ background: member.color }} />{member.name}</span>) : <span><i style={{ background: data.members.find((member) => member.id === scope)?.color }} />{t.selectedMember}</span>}</div></div><div className="chart-wrap"><div className="y-labels"><span>{formatMoney(maxWeekly * 100)}</span><span>{formatMoney(maxWeekly * 50)}</span><span>{formatMoney(0)}</span></div><svg viewBox="0 0 300 124" preserveAspectRatio="none" role="img" aria-label={t.rhythm}><line x1="8" y1="24" x2="296" y2="24" /><line x1="8" y1="68" x2="296" y2="68" /><line x1="8" y1="112" x2="296" y2="112" /><polygon points={`10,112 ${points} 290,112`} /><polyline points={points} />{weekly.map((value, index) => <circle key={index} cx={10 + index * 40} cy={112 - (value / maxWeekly) * 88} r="3" />)}</svg></div><div className="x-labels"><span>{t.weeksAgo8}</span><span>{t.weeks6}</span><span>{t.weeks4}</span><span>{t.weeks2}</span><span>{t.thisWeek}</span></div></article><article className="panel breakdown-panel"><div className="panel-head"><div><span className="eyebrow">{t.allActivity}</span><h2>{t.byCategory}</h2></div></div><div className="donut-row"><div className="donut" style={{ background: `conic-gradient(${donut || "#e7e8e2 0 360deg"})` }}><div><strong>{formatMoney(categorySum)}</strong><span>{t.total}</span></div></div><div className="category-list">{categoryTotals.slice(0, 4).map((item) => <div key={item.category}><i style={{ background: categoryColor(item.category) }} /><span>{categoryLabel(language, item.category)}</span><b>{Math.round((item.total / categorySum) * 100)}%</b></div>)}</div></div></article></section>

      <section className="bottom-grid" id="activity"><article className="panel activity-panel"><div className="panel-head"><div><span className="eyebrow">{t.latest}</span><h2>{t.recent}</h2></div><button className="link-button" onClick={() => setModal("activity")}>{t.viewAll} <span>→</span></button></div><div className="transaction-list">{visibleTransactions.slice(0, 5).map((item) => { const member = data.members.find((person) => person.id === item.memberId); const color = categoryColor(item.category); return <div className="transaction" key={item.id}><span className="category-icon" style={{ color, background: `${color}18` }}>{categoryIcons[item.category] ?? "•"}</span><div className="transaction-copy"><b>{item.note}</b><span>{categoryLabel(language, item.category)} · {new Date(item.happenedAt).toLocaleDateString(language === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "short" })}{item.currency !== "EUR" ? ` · ${item.currency}` : ""}</span></div>{item.source === "telegram" && <span className="source-badge">↗ {t.bot}</span>}<span className="mini-avatar" title={member?.name} aria-label={member?.name} style={{ background: member?.color }}>{initials(member?.name ?? "?")}</span><strong className="transaction-amount">−{formatMoney(item.baseAmountCents, 2)}</strong></div>; })}{visibleTransactions.length === 0 && <div className="empty-state"><span>✦</span><b>{t.emptyTitle}</b><p>{t.emptyText}</p></div>}</div></article><aside className="side-stack"><article className="panel rates-panel"><div className="panel-head"><div><span className="eyebrow">{language === "nl" ? "LIVE KOERSEN" : "LIVE RATES"}</span><h2>{language === "nl" ? "€1 is gelijk aan" : "€1 equals"}</h2></div><span className="api-badge">{language === "nl" ? "Live gegevens" : "Live data"}</span></div><div className="rates">{(["USD", "GBP", "CAD"] as Currency[]).map((code) => <div key={code}><span>{currencySymbols[code]}</span><b>{rates?.[code]?.toFixed(3) ?? (code === "USD" ? "1.160" : code === "GBP" ? "0.870" : "1.590")}</b><small>{code}</small></div>)}</div><p>{t.refreshed}</p></article><article className="phase-card"><div className="phase-orbit">✦</div><div><span>{t.familySpace}</span><h3>{t.readyGrow}</h3><p>{t.future}</p></div></article></aside></section>

      <button className="settings-fab" onClick={() => setModal("settings")} aria-label={language === "nl" ? "Instellingen" : "Settings"}>⚙</button><button className="fab" onClick={() => setModal("expense")}><span>＋</span>{t.addExpense}</button></main>
    {modal === "expense" && <AddExpenseModal data={data} language={language} rates={rates} demoMode={isDemo} onClose={() => setModal(null)} onSaved={(item) => setData((old) => ({ ...old, transactions: [item, ...old.transactions] }))} />}
    {modal === "invite" && <InviteModal language={language} data={data} demoMode={isDemo} onClose={() => setModal(null)} onUpdated={setData} />}
    {modal === "members" && <MemberManagementModal language={language} data={data} demoMode={isDemo} onClose={() => setModal(null)} onInvite={() => setModal("invite")} onUpdated={(updated) => { setData(updated); if (scope !== "family" && !updated.members.some((member) => member.id === scope && member.status === "active")) setScope("family"); }} />}
    {modal === "activity" && <ActivityModal items={visibleTransactions} members={data.members} currentMemberId={data.currentMemberId} language={language} displayCurrency={displayCurrency} rates={rates} onClose={() => setModal(null)} onEdit={(item) => { setSelectedTransaction(item); setModal("edit"); }} />}
    {modal === "edit" && selectedTransaction && <EditExpenseModal item={selectedTransaction} data={data} language={language} demoMode={isDemo} onClose={() => { setSelectedTransaction(null); setModal(null); }} onUpdated={(item) => setData((old) => ({ ...old, transactions: old.transactions.map((entry) => entry.id === item.id ? item : entry) }))} onDeleted={(id) => setData((old) => ({ ...old, transactions: old.transactions.filter((entry) => entry.id !== id) }))} />}
    {modal === "settings" && <SettingsModal data={data} language={language} demoMode={isDemo} onClose={() => setModal(null)} onUpdated={setData} />}
  </div>;
}
