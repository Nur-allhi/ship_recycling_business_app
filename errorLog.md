# &#x20;GET / 200 in 327ms

# &#x20;POST / 200 in 320ms

# &#x20;GET /favicon.ico 200 in 524ms

# Server Action Error: TypeError: Transaction function cannot return a promise

# &#x20;   at setInitialBalances (src/lib/actions.ts:738:17)

# &#x20; 736 |         if (!session || session.role !== 'admin') throw new Error("Only admins can set initial balances.");

# &#x20; 737 |

# > 738 |         await db.transaction(async (tx) => {

# &#x20;     |                 ^

# &#x20; 739 |             await tx.delete(schema.cashTransactions).where(eq(schema.cashTransactions.category, 'Initial Balance'));

# &#x20; 740 |             await tx.delete(schema.bankTransactions).where(eq(schema.bankTransactions.category, 'Initial Balance'));

# &#x20; 741 |             await tx.delete(schema.initialStock);

# &#x20;⨯ Error: Transaction function cannot return a promise

# &#x20;   at handleApiError (src/lib/actions.ts:55:10)

# &#x20;   at setInitialBalances (src/lib/actions.ts:769:15)

# &#x20; 53 |     console.error("Server Action Error:", error);

# &#x20; 54 |     // And re-throw a generic or specific error message

# > 55 |     throw new Error(error.message || "An unexpected server error occurred.");

# &#x20;    |          ^

# &#x20; 56 | }

# &#x20; 57 |

# &#x20; 58 | {

# &#x20; digest: '2619051709'

# }

# &#x20;POST / 500 in 889ms

