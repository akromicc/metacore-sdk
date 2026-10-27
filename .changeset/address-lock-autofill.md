---
"@asteby/storefront-react": patch
---

AddressFields: the postal code now always wins over state and city. A value the browser autofilled (no keys on the field), equal or different, is replaced by the catalog's and locked (read-only, `autocomplete="off"`); only text the buyer typed with real keys and that differs from the code's stays editable, with a note. Editing the postal code over a filled address re-resolves (state, city and colonia not in the new list are cleared; a code that resolves nothing frees and clears them), dependents are `aria-busy` while the lookup runs, and stale answers are discarded.
