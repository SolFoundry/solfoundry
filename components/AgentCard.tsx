import React from 'react';
import { Avatar, Badge, Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.3s ease-in-out',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
  },
}));

const StatusChip = styled(Chip)<{ status: 'online' | 'offline' | 'busy' }>(({ theme, status }) => ({
  backgroundColor: 
    status === 'online' ? theme.palette.success.main :
    status === 'busy' ? theme.palette.warning.main :
    theme.palette.grey[500],
  color: theme.palette.common.white,
  fontWeight: 'bold',
  fontSize: '0.75rem',
}));

const SuccessRateBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.primary.light,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1),
  textAlign: 'center',
  marginTop: theme.spacing(1),
}));

interface AgentCardProps {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  successRate: number;
  status: 'online' | 'offline' | 'busy';
  onClick?: (id: string) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({
  id,
  name,
  avatar,
  role,
  successRate,
  status,
  onClick,
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick(id);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'busy':
        return 'Busy';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  return (
    <StyledCard onClick={handleClick}>
      <CardContent>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: 
                    status === 'online' ? 'success.main' :
                    status === 'busy' ? 'warning.main' :
                    'grey.500',
                  border: '2px solid white',
                }}
              />
            }
          >
            <Avatar
              src={avatar}
              alt={name}
              sx={{ width: 80, height: 80, fontSize: '2rem' }}
            >
              {!avatar && name.charAt(0).toUpperCase()}
            </Avatar>
          </Badge>

          <Box textAlign="center" width="100%">
            <Typography variant="h6" component="h3" gutterBottom>
              {name}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {role}
            </Typography>

            <StatusChip
              label={getStatusText(status)}
              status={status}
              size="small"
            />

            <SuccessRateBox>
              <Typography variant="body2" color="primary.dark" fontWeight="bold">
                Success Rate
              </Typography>
              <Typography variant="h6" color="primary.main">
                {successRate}%
              </Typography>
            </SuccessRateBox>
          </Box>
        </Box>
      </CardContent>
    </StyledCard>
  );
};

export default AgentCard;