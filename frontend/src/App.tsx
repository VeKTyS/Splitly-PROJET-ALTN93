import { AppBar, Container, Link, Toolbar } from '@mui/material'
import { Navigate, Route, Link as RouterLink, Routes } from 'react-router-dom'
import GroupPage from './pages/GroupPage'
import HomePage from './pages/HomePage'

export default function App() {
  return (
    <>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Link component={RouterLink} to="/" color="inherit" underline="none" variant="h6" sx={{ fontWeight: 700 }}>
            Splitly
          </Link>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/groups/:id" element={<GroupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>
    </>
  )
}
