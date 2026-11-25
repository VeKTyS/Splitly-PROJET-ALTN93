import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  FormLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, api } from '../services/api'
import { formatCents, formatShortDate, parseAmountToCents, todayLocal } from '../services/money'
import { CATEGORIES, type Category, type Expense, type Group } from '../types'

const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : 'Une erreur est survenue.')

/** Plus recentes d'abord, comme le renvoie expense-service. */
const byDateDesc = (a: Expense, b: Expense) => b.date.localeCompare(a.date) || b.id - a.id

export default function Expenses({ group, me }: { group: Group; me: number | null }) {
  const [expenses, setExpenses] = useState<Expense[] | null>(null) // null = en cours de chargement
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let cancelled = false // evite d'ecrire l'etat d'une page deja quittee
    api
      .listExpenses(group.id)
      .then((list) => {
        if (!cancelled) setExpenses(list)
      })
      .catch((err) => {
        if (!cancelled) {
          setExpenses([])
          setError(errorMessage(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [group.id])

  const names = new Map(group.participants.map((p) => [p.id, p.name]))
  const nameOf = (id: number) => names.get(id) ?? 'Ancien participant'

  async function remove(expense: Expense) {
    setError(null)
    try {
      await api.deleteExpense(expense.id)
    } catch (err) {
      // 404 : deja supprimee ailleurs, on aligne simplement l'affichage.
      if (!(err instanceof ApiError && err.status === 404)) {
        setError(errorMessage(err))
        return
      }
    }
    setExpenses((list) => list?.filter((e) => e.id !== expense.id) ?? null)
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Dépenses
        </Typography>
        {!adding && group.participants.length > 0 && (
          <Button size="small" variant="contained" onClick={() => setAdding(true)}>
            Ajouter une dépense
          </Button>
        )}
      </Stack>

      {adding && group.participants.length > 0 && (
        <ExpenseForm
          group={group}
          me={me}
          onCancel={() => setAdding(false)}
          onSaved={(expense) => {
            setExpenses((list) => [...(list ?? []), expense].sort(byDateDesc))
            setAdding(false)
          }}
        />
      )}

      {group.participants.length === 0 ? (
        <Typography color="text.secondary" sx={{ my: 1 }}>
          Ajoute d’abord les participants, puis tu pourras saisir les dépenses.
        </Typography>
      ) : expenses?.length === 0 && !adding ? (
        <Typography color="text.secondary" sx={{ my: 1 }}>
          Aucune dépense pour l’instant.
        </Typography>
      ) : (
        <List dense>
          {(expenses ?? []).map((e) => (
            <ListItem
              key={e.id}
              divider
              secondaryAction={
                <Tooltip title={`Supprimer « ${e.label} »`}>
                  <IconButton edge="end" onClick={() => remove(e)} aria-label={`Supprimer ${e.label}`}>
                    <DeleteOutlinedIcon />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemText
                primary={e.label}
                secondary={`payé par ${nameOf(e.payerId)} · ${formatShortDate(e.date)} · ${CATEGORIES[e.category]}`}
              />
              <Typography sx={{ fontWeight: 600, mr: 2, whiteSpace: 'nowrap' }}>
                {formatCents(e.amountCents, group.currency)}
              </Typography>
            </ListItem>
          ))}
        </List>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}
    </Paper>
  )
}

function ExpenseForm({
  group,
  me,
  onCancel,
  onSaved,
}: {
  group: Group
  me: number | null
  onCancel: () => void
  onSaved: (expense: Expense) => void
}) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  // Par defaut : le payeur, c'est moi ; tout le monde profite de la depense.
  const [payerId, setPayerId] = useState(() => me ?? group.participants[0].id)
  const [beneficiaryIds, setBeneficiaryIds] = useState(() => new Set(group.participants.map((p) => p.id)))
  const [category, setCategory] = useState<Category>('autre')
  const [date, setDate] = useState(todayLocal())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const cents = parseAmountToCents(amount)
  const amountInvalid = amount.trim() !== '' && cents === null
  const canSubmit = !busy && label.trim() !== '' && cents !== null && beneficiaryIds.size > 0 && date !== ''

  function toggle(id: number) {
    setBeneficiaryIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (cents === null) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      onSaved(
        await api.addExpense({
          groupId: group.id,
          label: label.trim(),
          amountCents: cents,
          payerId,
          // Dans l'ordre des participants : RG2 attribue les centimes restants aux premiers beneficiaires.
          beneficiaryIds: group.participants.map((p) => p.id).filter((id) => beneficiaryIds.has(id)),
          category,
          date,
        }),
      )
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Box component="form" onSubmit={submit} sx={{ mt: 2, mb: 1 }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            label="Quoi ?"
            placeholder="Restaurant"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            size="small"
            fullWidth
            autoFocus
          />
          <TextField
            label={`Montant (${group.currency})`}
            placeholder="12,50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amountInvalid}
            helperText={amountInvalid ? 'Exemple : 12,50' : undefined}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            size="small"
            sx={{ minWidth: 140 }}
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            select
            label="Payé par"
            value={payerId}
            onChange={(e) => setPayerId(Number(e.target.value))}
            size="small"
            fullWidth
          >
            {group.participants.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Catégorie"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            size="small"
            fullWidth
          >
            {Object.entries(CATEGORIES).map(([value, text]) => (
              <MenuItem key={value} value={value}>
                {text}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
            fullWidth
          />
        </Stack>

        <Box>
          <FormLabel sx={{ fontSize: 14 }}>Pour qui ?</FormLabel>
          <FormGroup row>
            {group.participants.map((p) => (
              <FormControlLabel
                key={p.id}
                control={<Checkbox size="small" checked={beneficiaryIds.has(p.id)} onChange={() => toggle(p.id)} />}
                label={p.name}
              />
            ))}
          </FormGroup>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button onClick={onCancel}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            Enregistrer
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
