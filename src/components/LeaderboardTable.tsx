import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
  Skeleton,
  TablePagination,
  Box,
  Typography
} from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  boxShadow: theme.shadows[2],
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  background: theme.palette.background.paper,
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const RankCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 'bold',
  fontSize: '1.1rem',
  color: theme.palette.primary.main,
}));

const UserCell = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
});

const UserInfo = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
});

const ScoreChip = styled(Chip)(({ theme }) => ({
  fontWeight: 'bold',
  minWidth: 80,
}));

interface LeaderboardEntry {
  id: string;
  rank: number;
  username: string;
  avatar?: string;
  score: number;
  level: number;
  achievements: number;
  status: 'active' | 'inactive';
}

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  loading?: boolean;
  page: number;
  rowsPerPage: number;
  totalCount: number;
  onPageChange: (event: unknown, newPage: number) => void;
  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const SkeletonRow: React.FC = () => (
  <StyledTableRow>
    <TableCell>
      <Skeleton variant="text" width={40} />
    </TableCell>
    <TableCell>
      <UserCell>
        <Skeleton variant="circular" width={40} height={40} />
        <UserInfo>
          <Skeleton variant="text" width={120} />
          <Skeleton variant="text" width={80} />
        </UserInfo>
      </UserCell>
    </TableCell>
    <TableCell>
      <Skeleton variant="rectangular" width={80} height={24} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={40} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={40} />
    </TableCell>
    <TableCell>
      <Skeleton variant="rectangular" width={60} height={20} />
    </TableCell>
  </StyledTableRow>
);

const getRankColor = (rank: number) => {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return undefined;
};

const getScoreColor = (score: number) => {
  if (score >= 10000) return 'primary';
  if (score >= 5000) return 'secondary';
  return 'default';
};

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  data,
  loading = false,
  page,
  rowsPerPage,
  totalCount,
  onPageChange,
  onRowsPerPageChange,
}) => {
  const navigate = useNavigate();

  const handleRowClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const skeletonRows = useMemo(
    () => Array.from({ length: rowsPerPage }, (_, index) => (
      <SkeletonRow key={index} />
    )),
    [rowsPerPage]
  );

  return (
    <Box>
      <StyledTableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Rank</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>User</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Score</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Level</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Achievements</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              skeletonRows
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body1" color="text.secondary" py={4}>
                    No leaderboard data available
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              data.map((entry) => (
                <StyledTableRow
                  key={entry.id}
                  onClick={() => handleRowClick(entry.id)}
                >
                  <RankCell style={{ color: getRankColor(entry.rank) }}>
                    #{entry.rank}
                  </RankCell>
                  <TableCell>
                    <UserCell>
                      <Avatar
                        src={entry.avatar}
                        alt={entry.username}
                        sx={{ width: 40, height: 40 }}
                      >
                        {entry.username.charAt(0).toUpperCase()}
                      </Avatar>
                      <UserInfo>
                        <Typography variant="body1" fontWeight="medium">
                          {entry.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Level {entry.level}
                        </Typography>
                      </UserInfo>
                    </UserCell>
                  </TableCell>
                  <TableCell>
                    <ScoreChip
                      label={entry.score.toLocaleString()}
                      color={getScoreColor(entry.score)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1">{entry.level}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1">{entry.achievements}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={entry.status}
                      color={entry.status === 'active' ? 'success' : 'default'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                </StyledTableRow>
              ))
            )}
          </TableBody>
        </Table>
      </StyledTableContainer>

      {!loading && data.length > 0 && (
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={onPageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={onRowsPerPageChange}
          rowsPerPageOptions={[10, 25, 50, 100]}
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        />
      )}
    </Box>
  );
};

export default LeaderboardTable;