import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Expenses from '../components/Expenses'
import { api, ApiError } from '../services/api'
import { localStore } from '../services/storage'
import type { Group, Participant } from '../types'

type LoadState =
  { kind: 'loading' } | { kind: 'missing' } | { kind: 'error'; message: string } | { kind: 'ready'; group: Group }

export default function GroupPage() {
  const groupId = Number(useParams().id)
  // key : passer d'un groupe a un autre recree le composant, donc repart de l'etat « loading ».
  return <GroupLoader key={groupId} groupId={groupId} />
}

function GroupLoader({ groupId }: { groupId: number }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false // evite d'ecrire l'etat d'une page deja quittee
    api
      .getGroup(groupId)
      .then((group) => {
        if (cancelled) {
          return
        }
        localStore.rememberGroup(group) // un lien ouvert directement ajoute aussi le groupe a « Mes groupes »
        setState({ kind: 'ready', group })
      })
      .catch((err) => {
        if (cancelled) {
          return
        }
        if (err instanceof ApiError && err.status === 404) {
          setState({ kind: 'missing' })
        } else {
          setState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Une erreur est survenue.' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [groupId])

  if (state.kind === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }
  if (state.kind === 'missing') {
    return <MissingGroup groupId={groupId} />
  }
  if (state.kind === 'error') {
    return <Alert severity="error">{state.message}</Alert>
  }
  return <GroupView group={state.group} onChange={(group) => setState({ kind: 'ready', group })} />
}

/** Le groupe n'existe plus (la base en memoire est videe a chaque redemarrage du serveur). L'action se fait ici. */
function MissingGroup({ groupId }: { groupId: number }) {
  const navigate = useNavigate()
  const known = localStore.getKnownGroups().some((g) => g.id === groupId)

  return (
    <Alert
      severity="warning"
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => {
            localStore.forgetGroup(groupId)
            navigate('/')
          }}
        >
          {known ? 'Retirer de mes groupes' : 'Retour'}
        </Button>
      }
    >
      Ce groupe n’existe plus.
    </Alert>
  )
}

function GroupView({ group, onChange }: { group: Group; onChange: (group: Group) => void }) {
  const [me, setMe] = useState<number | null>(() => {
    const stored = localStore.getMe(group.id)
    // Si « moi » a ete supprime entre-temps, on oublie le choix.
    return group.participants.some((p) => p.id === stored) ? stored : null
  })
  const [copied, setCopied] = useState(false)

  function chooseMe(participantId: number | null) {
    localStore.setMe(group.id, participantId)
    setMe(participantId)
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(group.inviteCode)
      setCopied(true)
    } catch {
      // Presse-papiers refuse (page non securisee) : le code reste lisible a l'ecran.
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {group.name}
          </Typography>
          <Chip label={group.currency} size="small" />
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 0.5 }}>
          <Typography color="text.secondary">
            Code pour inviter : <strong style={{ letterSpacing: 2 }}>{group.inviteCode}</strong>
          </Typography>
          <Tooltip title="Copier le code">
            <IconButton size="small" onClick={copyCode} aria-label="Copier le code">
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {group.participants.length > 0 && (
        <TextField
          select
          label="Je suis…"
          value={me ?? ''}
          onChange={(e) => chooseMe(e.target.value === '' ? null : Number(e.target.value))}
          size="small"
          sx={{ maxWidth: 260 }}
        >
          <MenuItem value="">
            <em>Choisir</em>
          </MenuItem>
          {group.participants.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
      )}

      <Participants
        group={group}
        me={me}
        onAdded={(p) => onChange({ ...group, participants: [...group.participants, p] })}
        onRemoved={(id) => {
          if (id === me) {
            chooseMe(null)
          }
          onChange({ ...group, participants: group.participants.filter((p) => p.id !== id) })
        }}
      />

      <Expenses group={group} me={me} />

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Code copié"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Stack>
  )
}

function Participants({
  group,
  me,
  onAdded,
  onRemoved,
}: {
  group: Group
  me: number | null
  onAdded: (p: Participant) => void
  onRemoved: (id: number) => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function add(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onAdded(await api.addParticipant(group.id, name.trim()))
      setName('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(p: Participant) {
    setError(null)
    try {
      await api.removeParticipant(group.id, p.id)
      onRemoved(p.id)
    } catch (err) {
      // 404 : deja supprime ailleurs, on aligne simplement l'affichage.
      if (err instanceof ApiError && err.status === 404) {
        onRemoved(p.id)
      } else {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
      }
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Participants
      </Typography>

      {group.participants.length === 0 ? (
        <Typography color="text.secondary" sx={{ my: 1 }}>
          Ajoute les personnes qui partagent les dépenses, toi compris.
        </Typography>
      ) : (
        <List dense>
          {group.participants.map((p) => (
            <ListItem
              key={p.id}
              divider
              secondaryAction={
                <Tooltip title={`Retirer ${p.name}`}>
                  <IconButton edge="end" onClick={() => remove(p)} aria-label={`Retirer ${p.name}`}>
                    <DeleteOutlinedIcon />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemText primary={p.id === me ? `${p.name} (moi)` : p.name} />
            </ListItem>
          ))}
        </List>
      )}

      <Stack direction="row" spacing={1} component="form" onSubmit={add} sx={{ mt: 1 }}>
        <TextField
          label="Prénom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 50 } }}
          size="small"
          fullWidth
        />
        <Button type="submit" variant="contained" disabled={busy || !name.trim()}>
          Ajouter
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
