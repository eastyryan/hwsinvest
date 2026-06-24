// Edit this list each year to update the board on the About page.
// Drop member photos into /public/board/ and reference them by filename.

export type Member = {
  name: string;
  role: string;
  year: string;
  img?: string; // e.g. "/board/easton.jpg" — optional; falls back to initials
  bio?: string;
  linkedin?: string;
};

export const board: Member[] = [
  {
    name: "Easton Ryan",
    role: "President",
    year: "Class of 2027",
    bio: "Leads club strategy, meetings, and the markets team.",
    linkedin: "",
  },
  {
    name: "Vice President",
    role: "Vice President",
    year: "Class of 20XX",
    bio: "Supports operations and coordinates research initiatives.",
  },
  {
    name: "Treasurer",
    role: "Treasurer",
    year: "Class of 20XX",
    bio: "Manages the club's budget and paper-trading portfolio.",
  },
  {
    name: "Head of Research",
    role: "Head of Research",
    year: "Class of 20XX",
    bio: "Oversees sector coverage and weekly market recaps.",
  },
];
