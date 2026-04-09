import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';

const Marketplace = () => {
    const [repos, setRepos] = useState([]);
    const [language, setLanguage] = useState('');
    const [stars, setStars] = useState(0);

    const fetchRepos = async () => {
        try {
            const result = await axios.get('https://api.github.com/repositories');
            setRepos(result.data);
        } catch (error) {
            console.error('Error fetching repositories: ', error);
        }
    };

    const handleFilter = () => {
        // Basic filtering logic can be placed here.
        console.log('Filtering by:', { language, stars });
    };

    useEffect(() => {
        fetchRepos();
    }, []);

    return (
        <div>
            <h1>Marketplace</h1>
            <input
                type="text"
                placeholder="Filter by language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
            />
            <input
                type="number"
                placeholder="Minimum stars"
                value={stars}
                onChange={(e) => setStars(Number(e.target.value))}
            />
            <button onClick={handleFilter}>Apply Filters</button>
            <ul>
                {repos.map((repo) => (
                    <li key={repo.id}>{repo.name}</li>
                ))}
            </ul>
        </div>
    );
};

export default Marketplace;