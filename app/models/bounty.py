from django.db import models
from django.contrib.postgres.search import SearchVectorField, SearchVector
from django.contrib.postgres.indexes import GinIndex
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class Bounty(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='medium')
    reward_amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    
    # Relationships
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_bounties')
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_bounties')
    
    # Tags for categorization
    tags = models.ManyToManyField('Tag', blank=True, related_name='bounties')
    
    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    due_date = models.DateTimeField(null=True, blank=True)
    
    # Search functionality
    search_vector = SearchVectorField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            GinIndex(fields=['search_vector']),
            models.Index(fields=['status', 'difficulty']),
            models.Index(fields=['creator', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.update_search_vector()

    def update_search_vector(self):
        """Update the search vector field with searchable content"""
        tag_names = ' '.join(self.tags.values_list('name', flat=True))
        
        Bounty.objects.filter(pk=self.pk).update(
            search_vector=SearchVector('title', weight='A') +
                         SearchVector('description', weight='B') +
                         SearchVector(models.Value(tag_names), weight='C')
        )

    @classmethod
    def search(cls, query):
        """Full-text search across bounties"""
        if not query:
            return cls.objects.none()
        
        return cls.objects.filter(
            search_vector=query
        ).order_by('-created_at')

    def is_open(self):
        """Check if bounty is available for assignment"""
        return self.status == 'open'

    def can_be_assigned_to(self, user):
        """Check if bounty can be assigned to a specific user"""
        return self.is_open() and user != self.creator

    def assign_to(self, user):
        """Assign bounty to a user"""
        if self.can_be_assigned_to(user):
            self.assignee = user
            self.status = 'assigned'
            self.save()
            return True
        return False


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default='#6B7280')  # Hex color code
    
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name