// Tidying what a player sends the developers ("Report a problem", "Ask for a game"). When the card room
// has an AI key, the player's words come back as a clear title and a concise report (or a game's proper
// name and a short note) for them to look over. They can change any of it, put their own words back,
// or go back and start again; nothing is sent until they press Send.
import { useEffect, useState } from "react";
import { bugs } from "./bugReport";

/** Whether this card room can tidy a report before it's sent (false until the server has said so). */
export function useTidy() {
  const [can, setCan] = useState(false);
  useEffect(() => void bugs.canTidy().then(setCan), []);
  return can;
}

/** The line at the top of the look-it-over step: what happened to their words. */
export function TidyNote({ tidied, what }: { tidied: boolean; what: "report" | "request" }) {
  return (
    <p className="fine tidy-note">
      {tidied
        ? `✨ Your ${what} was tidied up so the developers can read it at a glance. Change anything you like, or put your own words back. Your own words go along with it too, folded away.`
        : `It couldn't be tidied just now, so your ${what} goes in your own words. You can still change them here.`}
    </p>
  );
}
