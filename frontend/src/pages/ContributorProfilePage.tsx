/** Route entry point for /profile/:username */
import { useParams } from 'react-router-dom';
import ContributorProfile from '../components/ContributorProfile';

export default function ContributorProfilePage() {
  const { username } = useParams<{ username: string }>();
  return <ContributorProfile username={username ?? ''} />;
}
