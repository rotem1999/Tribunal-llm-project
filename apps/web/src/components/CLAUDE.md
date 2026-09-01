# components/

SpeechCard, VerdictCard, EconomyPanel, ModeToggle, VerdictTally, etc.
- **VerdictCard**: badge for `justified` vs `not_justified`, confidence, and the full reasoning/protocol.
- **SpeechCard**: grouped Support (defense) vs Against (prosecution).
- **EconomyPanel**: per-persona + per-model + totals (tokens & USD), "$0.00 (free)" shown honestly, Download JSON.
- **ModeToggle**: Single-model (A) vs Model-per-persona (B).
- **ModelPicker**: one model `<select>` (§5.2/§11). Free by default; paid shown only when `showPaid` (the selected model always stays visible). Mode A offers "Auto"; Mode B requires a pick. Price shown per 1M tokens.
- **VerdictTally**: non-binding counts, labelled "no combined verdict".
