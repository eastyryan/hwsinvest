// Edit this list each year to update the board on the About page.
// Drop member photos into /public/board/ and reference them by filename.

export type Member = {
  name: string;
  role: string;
  year?: string;
  focus?: string; // sector or area of focus, BC-style
  img?: string; // e.g. "/board/easton.jpg", optional; falls back to initials
  bio?: string;
  linkedin?: string;
  hidden?: boolean; // keep the profile here but leave it off the About page
};

// President first, then the rest alphabetically by last name.
export const board: Member[] = [
  {
    name: "Easton Ryan",
    role: "President",
    year: "Class of 2027",
    focus: "Markets & Strategy",
    img: "/board/easton.jpg",
    bio: "Easton runs the club's weekly meetings and sets the direction for the markets team. Outside the club, he follows macro trends and is always up for debating where rates head next.",
    linkedin: "https://www.linkedin.com/in/easton-ryan/",
  },
  {
    name: "Kira Fulton",
    role: "Director of Governance & Proxy Research",
    year: "Class of 2027",
    focus: "Governance",
    img: "/board/kira.jpg",
    bio: "Kira leads the club's governance work: reading proxy statements, tracking board composition and executive pay, and flagging the shareholder votes that actually matter to a thesis. She helps members see the part of an investment case that never shows up in the financials.",
    linkedin: "https://www.linkedin.com/in/kira-fulton/",
  },
  {
    name: "Conor Lally",
    role: "Director of Market Data & Analytics",
    year: "Class of 2027",
    focus: "Data & Analytics",
    img: "/board/conor.jpg",
    bio: "Conor owns the data behind the club's research: pulling price and fundamental series, keeping our screens and dashboards current, and making sure every pitch rests on numbers other members can reproduce.",
    linkedin: "https://www.linkedin.com/in/conor-lally-97593930b/",
    hidden: true,
  },
  {
    name: "Inigo Llosa",
    role: "Treasurer",
    year: "Class of 2028",
    focus: "Portfolio & Budget",
    img: "/board/inigo.jpg",
    bio: "Inigo manages the club's budget and reports on how the portfolio is performing. He keeps the books, tracks positions and returns, and makes sure members can always see exactly where the club stands.",
    linkedin: "https://www.linkedin.com/in/inigo-llosa/",
  },
  {
    name: "Thomas McDonough",
    role: "Head of Financial Modeling",
    year: "Class of 2029",
    focus: "Modeling & Valuation",
    img: "/board/thomas.jpg",
    bio: "Thomas runs the club's modeling work, the three-statement builds and DCFs behind our pitches, and teaches new members how to put one together from a blank spreadsheet. He leads the modeling workshops each semester.",
    linkedin: "https://www.linkedin.com/in/tommy-mcdonough/",
  },
  {
    name: "Olivia Wilkins",
    role: "Director of Capital Markets & M&A",
    year: "Class of 2028",
    focus: "Capital Markets",
    img: "/board/olivia.jpg",
    bio: "Olivia covers deal flow for the club: tracking M&A, IPOs, and financing activity, and breaking down how transactions actually get structured and valued. She leads the sessions on following a deal from announcement to close.",
    linkedin: "https://www.linkedin.com/in/olivia-wilkins10/",
  },
];
