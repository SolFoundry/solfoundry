import React from 'react';

const BountiesList: React.FC = () => {
    return (
        <div>
            <label htmlFor="filter">Filter by language</label>
            <select id="filter">
                <option value="JavaScript">JavaScript</option>
                <option value="Python">Python</option>
                <option value="Java">Java</option>
            </select>
        </div>
    );
};

export default BountiesList;