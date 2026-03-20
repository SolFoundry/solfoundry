#!/bin/bash
echo 'Installing Certbot and Nginx plugin...'
sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx

echo 'Obtaining/renewing SSL certificate with Certbot...'
echo 'Please replace your_domain.com with your actual domain.'
sudo certbot --nginx -d your_domain.com -d www.your_domain.com --agree-tos --email admin@your_domain.com --non-interactive

echo 'Setting up Certbot auto-renewal cron job...'
(crontab -l 2>/dev/null; echo "0 */12 * * * sudo certbot renew --quiet") | crontab -

echo 'SSL/TLS setup complete.'
