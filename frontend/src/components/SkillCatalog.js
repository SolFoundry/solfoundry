import React, { useState, useEffect } from 'react';

const SkillCatalog = () => {
  const [skills, setSkills] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchSkills();
  }, []);

  const installSkill = async (skillId) => {
     // API call to handle installation
    try {
      const response = await fetch(`/api/skills/${skillId}/install`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to install skill');
      alert('Skill installed successfully!');
    } catch (error) {
      console.error(error);
      alert('Installation failed.');
    }
  };

  const fetchSkills = async () => {
    // Placeholder API call, replace with actual endpoint
    const response = await fetch('/api/skills');
    const data = await response.json();
    setSkills(data);
  };

  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <h1>Skill Catalog</h1>
      <input 
        type="text" 
        placeholder="Search for skills..." 
        value={filter} 
        onChange={e => setFilter(e.target.value)}
      />
      <ul>
        {filteredSkills.map(skill => (
          <li key={skill.id}> {skill.name} - {skill.rating}/5
            <button onClick={() => installSkill(skill.id)}>Install</button>
          </li>
        ))}
        {filteredSkills.map(skill => (
          <li key={skill.id}> {skill.name} - {skill.rating}/5</li>
        ))}
      </ul>
    </div>
  );
};

export default SkillCatalog;
