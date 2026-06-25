// Edit this list each year to update the board on the About page.
// Drop member photos into /public/board/ and reference them by filename.

export type Member = {
  name: string;
  role: string;
  year: string;
  focus?: string; // sector or area of focus, BC-style
  img?: string; // e.g. "/board/easton.jpg" — optional; falls back to initials
  bio?: string;
  linkedin?: string;
};

export const board: Member[] = [
  {
    name: "Easton Ryan",
    role: "President",
    year: "Class of 2027",
    focus: "Markets & Strategy",
    bio: "Easton runs the club's weekly meetings and sets the direction for the markets team. Outside the club, he follows macro trends and is always up for debating where rates head next.",
    linkedin: "",
  },
  {
    name: "Maya Caldwell",
    role: "Vice President",
    year: "Class of 2026",
    focus: "Financials",
    bio: "Maya keeps the club's operations running and helps new members find their footing in research. She spent last summer interning with a regional bank's credit team.",
  },
  {
    name: "Daniel Okafor",
    role: "Treasurer",
    year: "Class of 2027",
    focus: "Consumer & Retail",
    bio: "Daniel manages the club budget and our paper-trading portfolio's performance reporting. He's especially interested in how brands turn loyalty into pricing power.",
  },
  {
    name: "Sophia Bennett",
    role: "Head of Research",
    year: "Class of 2026",
    focus: "Technology",
    bio: "Sophia leads sector coverage and edits the club's weekly market recaps. She loves digging into earnings calls and pulling out the one detail everyone else missed.",
  },
];
