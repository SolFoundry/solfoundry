import React, { useState } from 'react';

const BountyClaimButton: React.FC<{ bountyId: number }> = ({ bountyId }) => {
    const [claimed, setClaimed] = useState(false);

    const handleClaim = () => {
        setClaimed(true);
    };

    return (
        <div>
            <button onClick={handleClaim}>Claim Bounty</button>
            {claimed && <p>Bounty {bountyId} claimed!</p>}
        </div>
    );
};

export default BountyClaimButton;