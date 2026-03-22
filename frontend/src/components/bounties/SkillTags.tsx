export function SkillTags({ skills, maxVisible = 3 }: { skills: string[]; maxVisible?: number }) {
  const v = skills.slice(0, maxVisible), o = skills.length - maxVisible;
  return (<div className="flex flex-wrap gap-1" data-testid="skill-tags">{v.map(s => <span key={s} className="rounded-md bg-gray-100 dark:bg-surface-200 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">{s}</span>)}{o > 0 && <span className="rounded-md bg-gray-100 dark:bg-surface-200 px-2 py-0.5 text-xs text-gray-500">+{o}</span>}</div>);
}
