// Every word the sheets show, to change one at a time: `copy={{ title: "Something broke?" }}`.

export interface ReportCopy {
  /** The button's label for screen readers. */
  open: string;
  title: string;
  /** Above the words box, and what's shown beside it. */
  words: string;
  wordsOptional: string;
  placeholder: string;
  shotLabel: string;
  shotDescription: string;
  shotAlt: string;
  noShot: string;
  browserLabel: string;
  browserDescription: string;
  seeWhatsSent: string;
  /** The fine print under the choices. */
  finePrint: string;
  /** Added to the fine print when the server tidies. */
  tidyNext: string;
  cancel: string;
  next: string;
  send: string;
  sending: string;
  tidying: string;
  reviewTitle: string;
  reviewTitleField: string;
  reviewWords: string;
  useOriginal: string;
  useTidied: string;
  yourOwnWords: string;
  back: string;
  sendReport: string;
  sentTitle: string;
  /** "Your report is in as number 12. There's nothing more to do." */
  sentBody: (number: number) => string;
  follow: string;
  done: string;
}

export const reportCopy: ReportCopy = {
  open: "Report a problem",
  title: "Report a problem",
  words: "What went wrong?",
  wordsOptional: "(you can leave this empty)",
  placeholder: "Something didn't load, a button did nothing, something looked off…",
  shotLabel: "Send a picture of the screen",
  shotDescription: "The screen as it was when you tapped the button. Look it over: anything on it is sent too.",
  shotAlt: "The picture of the screen that would be sent",
  noShot: "A picture of the screen couldn't be taken on this device, so none is sent.",
  browserLabel: "Send my browser's details",
  browserDescription: "Which browser and device this is, and the size of its screen.",
  seeWhatsSent: "See exactly what's sent",
  finePrint: "Reports are posted where anyone can read them, so the people who build this can fix things. Yours also says which screen you were on and any errors the page ran into. It never includes your name.",
  tidyNext: " Next, you'll see it tidied up for the developers, and you can change it before it's sent.",
  cancel: "Cancel",
  next: "Next",
  send: "Send report",
  sending: "Sending…",
  tidying: "Tidying it up…",
  reviewTitle: "Look it over",
  reviewTitleField: "Title",
  reviewWords: "What went wrong",
  useOriginal: "Put my own words back",
  useTidied: "Use the tidied version",
  yourOwnWords: "Your own words",
  back: "Back",
  sendReport: "Send report",
  sentTitle: "Thank you!",
  sentBody: (number) => `Your report is in as number ${number}. There's nothing more to do.`,
  follow: "follow it on GitHub",
  done: "Done",
};

export interface RequestCopy {
  title: string;
  nameLabel: string;
  namePlaceholder: string;
  noteLabel: string;
  noteOptional: string;
  notePlaceholder: string;
  finePrint: string;
  cancel: string;
  next: string;
  send: string;
  sending: string;
  tidying: string;
  reviewTitle: string;
  tidyNote: string;
  useOriginal: string;
  useTidied: string;
  seeWhatsSent: string;
  yourOwnWords: string;
  noNote: string;
  back: string;
  sendRequest: string;
  sentTitle: string;
  /** Someone has already asked, so their voice was added to it. */
  againTitle: string;
  sentBody: (name: string, number: number, again: boolean) => string;
  follow: string;
  done: string;
}

export const requestCopy: RequestCopy = {
  title: "Make a request",
  nameLabel: "What would you like?",
  namePlaceholder: "A feature, a fix, a thing you wish it did…",
  noteLabel: "Anything we should know?",
  noteOptional: "(you can leave this empty)",
  notePlaceholder: "How you'd use it, what you've tried, what you can't do without…",
  finePrint: "Requests are posted where anyone can read them, so the people who build this can see what to make next. Yours never includes your name.",
  cancel: "Cancel",
  next: "Next",
  send: "Send request",
  sending: "Sending…",
  tidying: "Tidying it up…",
  reviewTitle: "Look it over",
  tidyNote: "Note",
  useOriginal: "Put my own words back",
  useTidied: "Use the tidied version",
  seeWhatsSent: "See exactly what's sent",
  yourOwnWords: "Your own words",
  noNote: "(none)",
  back: "Back",
  sendRequest: "Send request",
  sentTitle: "Asked!",
  againTitle: "You're not the only one!",
  sentBody: (name, number, again) => `${again ? `Someone has already asked for ${name}, so your voice was added to theirs.` : `Your request for ${name} is in.`} It's number ${number}.`,
  follow: "follow it on GitHub",
  done: "Done",
};

/** The line at the top of the look-it-over step: what happened to their words. */
export interface TidyCopy {
  tidied: (what: string) => string;
  untidied: (what: string) => string;
}
export const tidyCopy: TidyCopy = {
  tidied: (what) => `✨ Your ${what} was tidied up so the developers can read it at a glance. Change anything you like, or put your own words back. Your own words go along with it too, folded away.`,
  untidied: (what) => `It couldn't be tidied just now, so your ${what} goes in your own words. You can still change them here.`,
};
