// Editable club facts — update these as the club grows.

export const clubStats = [
  { value: "55+", label: "Members", note: "and growing every semester" },
  { value: "6", label: "Sectors covered", note: "tech, financials, energy & more" },
  { value: "Wed · 7PM", label: "Weekly meetings", note: "open to all HWS students" },
];

export const meeting = {
  day: "Wednesdays",
  time: "7:00 PM",
  blurb: "Open to every HWS student — no experience or finance background needed.",
};

// Where the contact form sends. Update to the club's real inbox.
export const contactEmail = "investmentclub@hws.edu";

// Firms where club members and alumni have landed. Logos live in
// /public/firms/. Add a new firm by dropping a logo there and adding a row.
// Every firm shows its name as a caption beneath the logo mark.
export type Firm = { name: string; logo: string };

export const firms: Firm[] = [
  { name: "J.P. Morgan", logo: "/firms/jpmorgan.png" },
  { name: "Goldman Sachs", logo: "/firms/goldman-sachs.png" },
  { name: "Morgan Stanley", logo: "/firms/morgan-stanley.png" },
  { name: "Bank of America", logo: "/firms/bank-of-america.png" },
  { name: "Citi", logo: "/firms/citi.png" },
  { name: "BlackRock", logo: "/firms/blackrock.png" },
  { name: "HSBC", logo: "/firms/hsbc.png" },
  { name: "Evercore", logo: "/firms/evercore.png" },
  { name: "Rithm Capital", logo: "/firms/rithm-capital.png" },
  { name: "Bloomberg", logo: "/firms/bloomberg-wordmark.svg" },
  { name: "Chubb", logo: "/firms/chubb.png" },
  { name: "S&P Global", logo: "/firms/sp-global.png" },
  { name: "Fidelity", logo: "/firms/fidelity.png" },
  { name: "UBS", logo: "/firms/ubs.png" },
  { name: "RBC", logo: "/firms/rbc.png" },
  { name: "CIBC", logo: "/firms/cibc.png" },
];
