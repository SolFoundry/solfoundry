#!/usr/bin/env python3
"""Generate SolFoundry social media templates as SVG files."""

import os

OUT = "/home/aa/.openclaw/workspace/projects/solfoundry-work/templates"
os.makedirs(OUT, exist_ok=True)

BRAND = {
    'bg': '#0d0d0f',
    'surface': '#1a1a1f',
    'emerald': '#10b981',
    'magenta': '#ec4899',
    'white': '#ffffff',
    'muted': '#6b7280',
    'border': '#2a2a35',
}

def gstop(g, offset, color, opacity=1.0):
    g.add_stop_color(offset, color, opacity=opacity)

def make_feed(i, title, reward, tier, outfile):
    """1080x1080 feed post template"""
    import svgwrite
    d = svgwrite.Drawing(outfile, profile='full', size=('1080', '1080'))
    d['style'] = 'background:#0d0d0f'

    # Gradient def
    tg = d.linearGradient(('0%','0%'),('100%','0%'), id='topGrad')
    tg.add_stop_color(0, BRAND['emerald'])
    tg.add_stop_color(1, '#06b6d4')
    d.defs.add(tg)

    rg = d.linearGradient(('0%','0%'),('100%','0%'), id='rewardGrad')
    rg.add_stop_color(0, BRAND['emerald'], opacity=0.4)
    rg.add_stop_color(1, '#06b6d4', opacity=0.4)
    d.defs.add(rg)

    tier_color = {'T1': BRAND['emerald'], 'T2': '#8b5cf6', 'T3': '#f59e0b'}.get(tier, BRAND['emerald'])

    # Background
    d.add(d.rect(insert=(0,0), size=('1080','1080'), fill=BRAND['bg']))
    # Top gradient bar
    d.add(d.rect(insert=(0,0), size=('1080','8'), fill='url(#topGrad)'))
    # Header bar
    d.add(d.rect(insert=(0,8), size=('1080','80'), fill=BRAND['surface']))
    # Logo text
    d.add(d.text('SOLFOUNDRY', insert=(48,62), fill=BRAND['emerald'],
                  font_family='Inter, Arial, sans-serif', font_size='20', font_weight='bold', letter_spacing='3'))
    # Tier badge
    d.add(d.rect(insert=(880,24), size=(160,48), rx='24', fill=tier_color))
    d.add(d.text(tier, insert=(960,55), fill='white',
                  font_family='Inter, Arial, sans-serif', font_size='18', font_weight='bold', text_anchor='middle'))
    # Content card
    d.add(d.rect(insert=(40,110), size=('1000','700'), rx='16',
                 fill=BRAND['surface'], stroke=BRAND['border'], stroke_width='1'))
    # Template number
    d.add(d.text(f'TEMPLATE {i+1}', insert=(60,155),
                  fill=BRAND['muted'], font_family='monospace', font_size='13', letter_spacing='2'))
    # Title placeholder box
    d.add(d.rect(insert=(60,175), size=('960','90'), rx='8',
                 fill=BRAND['bg'], stroke=BRAND['emerald'], stroke_width='1', stroke_dasharray='6,4'))
    d.add(d.text('[ BOUNTY TITLE ]', insert=(540,225),
                  fill=BRAND['muted'], font_family='Inter, Arial, sans-serif',
                  font_size='26', text_anchor='middle', font_style='italic'))
    # Reward box
    d.add(d.rect(insert=(240,295), size=('600','110'), rx='12',
                 fill='url(#rewardGrad)', stroke=BRAND['emerald'], stroke_width='2'))
    d.add(d.text('REWARD', insert=(540,332),
                  fill=BRAND['muted'], font_family='Inter, Arial, sans-serif',
                  font_size='13', text_anchor='middle', letter_spacing='3'))
    d.add(d.text(reward, insert=(540,390),
                  fill=BRAND['emerald'], font_family='Inter, Arial, sans-serif',
                  font_size='48', font_weight='bold', text_anchor='middle'))
    # Divider
    d.add(d.line((120,440),(960,440), stroke=BRAND['border'], stroke_width='1'))
    # Description placeholder
    d.add(d.rect(insert=(60,460), size=('960','80'), rx='8',
                 fill=BRAND['bg'], stroke=BRAND['border'], stroke_width='1', stroke_dasharray='4,4'))
    d.add(d.text('[ One-sentence bounty description ]', insert=(540,505),
                  fill=BRAND['muted'], font_family='Inter, Arial, sans-serif',
                  font_size='18', text_anchor='middle', font_style='italic'))
    # CTA section
    d.add(d.rect(insert=(40,810), size=('1000','250'), rx='16',
                 fill=BRAND['surface'], stroke=BRAND['border'], stroke_width='1'))
    d.add(d.text('⚒', insert=(540,870), fill=BRAND['emerald'],
                  font_family='Arial', font_size='48', text_anchor='middle'))
    d.add(d.text('SOLVE THIS BOUNTY', insert=(540,930),
                  fill='white', font_family='Inter, Arial, sans-serif',
                  font_size='26', font_weight='bold', text_anchor='middle', letter_spacing='1'))
    d.add(d.text('github.com/solfoundry/solfoundry', insert=(540,975),
                  fill=BRAND['muted'], font_family='Inter, Arial, sans-serif',
                  font_size='14', text_anchor='middle'))
    d.add(d.text('#BountyHunting  #Web3  #Solana', insert=(540,1015),
                  fill=BRAND['emerald'], font_family='Inter, Arial, sans-serif',
                  font_size='14', text_anchor='middle', letter_spacing='1'))
    # Footer gradient
    d.add(d.rect(insert=(0,1072), size=('1080','8'), fill='url(#topGrad)'))
    d.save()
    print(f"Saved: {outfile}")


def make_card(i, title, reward, tier, outfile):
    """1200x675 Twitter/X card template"""
    import svgwrite
    d = svgwrite.Drawing(outfile, profile='full', size=('1200', '675'))
    d['style'] = 'background:#0d0d0f'

    tg = d.linearGradient(('0%','0%'),('100%','0%'), id='topGrad')
    tg.add_stop_color(0, BRAND['emerald'])
    tg.add_stop_color(1, '#06b6d4')
    d.defs.add(tg)

    tier_color = {'T1': BRAND['emerald'], 'T2': '#8b5cf6', 'T3': '#f59e0b'}.get(tier, BRAND['emerald'])

    # Background
    d.add(d.rect(insert=(0,0), size=('1200','675'), fill=BRAND['bg']))
    d.add(d.rect(insert=(0,667), size=('1200','8'), fill='url(#topGrad)'))

    # Header
    d.add(d.rect(insert=(0,0), size=('1200','80'), fill=BRAND['surface']))
    d.add(d.text('SOLFOUNDRY', insert=(40,52), fill=BRAND['emerald'],
                  font_family='Inter, Arial, sans-serif', font_size='18', font_weight='bold', letter_spacing='3'))
    d.add(d.rect(insert=(980,22), size=(180,46), rx='23', fill=tier_color))
    d.add(d.text(tier, insert=(1070,52), fill='white',
                  font_family='Inter, Arial, sans-serif', font_size='16', font_weight='bold', text_anchor='middle'))

    # Content card
    d.add(d.rect(insert=(40,100), size=('1120','540'), rx='16',
                 fill=BRAND['surface'], stroke=BRAND['border'], stroke_width='1'))

    # Title placeholder
    d.add(d.rect(insert=(80,130), size=('1040','80'), rx='8',
                 fill=BRAND['bg'], stroke=BRAND['emerald'], stroke_width='1', stroke_dasharray='6,4'))
    d.add(d.text('[ BOUNTY TITLE ]', insert=(600,175),
                  fill=BRAND['muted'], font_family='Inter, Arial, sans-serif',
                  font_size='22', text_anchor='middle', font_style='italic'))

    # Reward highlight
    d.add(d.rect(insert=(350,245), size=('500','95'), rx='12',
                 fill=tier_color, opacity=0.15, stroke=tier_color, stroke_width='2'))
    d.add(d.text('REWARD', insert=(600,275),
                  fill=BRAND['muted'], font_family='Inter, Arial, sans-serif',
                  font_size='12', text_anchor='middle', letter_spacing='3'))
    d.add(d.text(reward, insert=(600,325),
                  fill=BRAND['emerald'], font_family='Inter, Arial, sans-serif',
                  font_size='40', font_weight='bold', text_anchor='middle'))

    # Description placeholder
    d.add(d.rect(insert=(80,370), size=('1040','60'), rx='8',
                 fill=BRAND['bg'], stroke=BRAND['border'], stroke_width='1', stroke_dasharray='4,4'))
    d.add(d.text('[ Describe the bounty in one compelling sentence ]',
                  insert=(600,408), fill=BRAND['muted'],
                  font_family='Inter, Arial, sans-serif', font_size='17', text_anchor='middle', font_style='italic'))

    # CTA button
    d.add(d.rect(insert=(440,465), size=('320','52'), rx='26', fill=BRAND['emerald']))
    d.add(d.text('VIEW BOUNTY  →', insert=(600,497),
                  fill='white', font_family='Inter, Arial, sans-serif',
                  font_size='15', font_weight='bold', text_anchor='middle'))

    # Hashtags
    d.add(d.text('#BountyHunting  #Web3  #Solana', insert=(600,560),
                  fill=BRAND['emerald'], font_family='Inter, Arial, sans-serif',
                  font_size='14', text_anchor='middle', letter_spacing='1'))

    d.save()
    print(f"Saved: {outfile}")


if __name__ == '__main__':
    templates = [
        ('NEW BOUNTY ALERT', '150K $FNDRY', 'T1'),
        ('FLASH BOUNTY', '500K $FNDRY', 'T2'),
        ('COMMUNITY PICKS', '200K $FNDRY', 'T1'),
        ('HOT BOUNTY', '1M $FNDRY', 'T3'),
        ('LAST CALL', '300K $FNDRY', 'T2'),
    ]

    for i, (title, reward, tier) in enumerate(templates):
        make_feed(i, title, reward, tier, f'{OUT}/t{i+1}_feed.svg')
        make_card(i, title, reward, tier, f'{OUT}/t{i+1}_card.svg')

    print(f'\nAll 10 SVG files generated in {OUT}')
