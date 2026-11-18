import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import {
  Alert,
  Button,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../services/api'
import { localStore } from '../services/storage'
import type { Group } from '../types'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF']

export default function HomePage() {
  const navigate = useNavigate()
  const groups = localStore.getKnownGroups()

  function open(group: Group) {
    localStore.rememberGroup(group)
    navigate(`/groups/${group.id}`)
  }

  return (
    <Stack spacing={3}>
      <section>
        <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Mes groupes
        </Typography>
        {groups.length === 0 ? (
          <Typography color="text.secondary">
            Aucun groupe pour l’instant. Crées-en un, ou rejoins celui d’un ami avec son code.
          </Typography>
        ) : (
          <Paper variant="outlined">
            <List disablePadding>
              {groups.map((g) => (
                <ListItemButton key={g.id} divider onClick={() => navigate(`/groups/${g.id}`)}>
                  <ListItemText primary={g.name} />
                  <ChevronRightIcon color="action" />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}
      </section>

      <CreateGroupForm onCreated={open} />
      <JoinGroupForm onFound={open} />
    </Stack>
  )
}

function CreateGroupForm({ onCreated }: { onCreated: (group: Group) => void }) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onCreated(await api.createGroup(name.trim(), currency))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
      setBusy(false)
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }} component="form" onSubmit={submit}>
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
        Nouveau groupe
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          label="Nom du groupe"
          placeholder="Week-end Lyon"
          value={name}
          onChange={(e) => setName(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 100 } }}
          size="small"
          fullWidth
          required
        />
        <TextField
          select
          label="Devise"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          size="small"
          sx={{ minWidth: 100 }}
        >
          {CURRENCIES.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <Button type="submit" variant="contained" disabled={busy || !name.trim()}>
          Créer
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}
    </Paper>
  )
}

function JoinGroupForm({ onFound }: { onFound: (group: Group) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onFound(await api.findGroupByInviteCode(code))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setError('Aucun groupe ne correspond à ce code.')
      else setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
      setBusy(false)
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }} component="form" onSubmit={submit}>
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
        Rejoindre un groupe
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          label="Code d’invitation"
          placeholder="ABC234"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          slotProps={{ htmlInput: { maxLength: 6, style: { letterSpacing: 2 } } }}
          size="small"
          fullWidth
        />
        <Button type="submit" variant="outlined" disabled={busy || code.trim().length !== 6}>
          Rejoindre
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}
    </Paper>
  )
}
