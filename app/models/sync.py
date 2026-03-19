from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder
import json


class SyncStatus(models.Model):
    SYNC_TYPES = [
        ('github_to_platform', 'GitHub to Platform'),
        ('platform_to_github', 'Platform to GitHub'),
        ('bidirectional', 'Bidirectional'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('partial', 'Partial'),
        ('cancelled', 'Cancelled'),
    ]
    
    sync_type = models.CharField(max_length=20, choices=SYNC_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    
    # Generic foreign key to link to any model
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # User who initiated the sync
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    
    # Sync metadata
    metadata = models.JSONField(default=dict, encoder=DjangoJSONEncoder)
    
    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['status', 'sync_type']),
            models.Index(fields=['started_at']),
        ]
    
    def __str__(self):
        return f"{self.sync_type} - {self.status} ({self.started_at})"
    
    def mark_completed(self):
        """Mark sync as completed"""
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.save()
    
    def mark_failed(self, error_message: str):
        """Mark sync as failed with error message"""
        self.status = 'failed'
        self.completed_at = timezone.now()
        self.error_message = error_message
        self.save()
    
    @property
    def duration(self):
        """Get sync duration if completed"""
        if self.completed_at:
            return self.completed_at - self.started_at
        return None


class SyncLog(models.Model):
    """Detailed log entries for sync operations"""
    LOG_LEVELS = [
        ('debug', 'Debug'),
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
    ]
    
    sync_status = models.ForeignKey(SyncStatus, on_delete=models.CASCADE, related_name='logs')
    level = models.CharField(max_length=10, choices=LOG_LEVELS)
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, encoder=DjangoJSONEncoder)
    
    class Meta:
        ordering = ['timestamp']
    
    def __str__(self):
        return f"{self.level.upper()}: {self.message[:50]}"


class SyncMapping(models.Model):
    """Maps platform objects to external system objects"""
    # Platform object
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # External system details
    external_system = models.CharField(max_length=50)  # 'github', 'jira', etc.
    external_id = models.CharField(max_length=255)
    external_url = models.URLField(null=True, blank=True)
    
    # Sync metadata
    last_synced = models.DateTimeField(auto_now=True)
    sync_direction = models.CharField(
        max_length=20,
        choices=SyncStatus.SYNC_TYPES,
        default='bidirectional'
    )
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ['content_type', 'object_id', 'external_system', 'external_id']
        indexes = [
            models.Index(fields=['external_system', 'external_id']),
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['last_synced']),
        ]
    
    def __str__(self):
        return f"{self.content_object} <-> {self.external_system}:{self.external_id}"


class SyncConfiguration(models.Model):
    """Configuration for sync operations"""
    name = models.CharField(max_length=100)
    external_system = models.CharField(max_length=50)
    sync_type = models.CharField(max_length=20, choices=SyncStatus.SYNC_TYPES)
    
    # Sync settings
    auto_sync = models.BooleanField(default=True)
    sync_interval = models.PositiveIntegerField(default=300)  # seconds
    batch_size = models.PositiveIntegerField(default=50)
    
    # Field mappings and transformations
    field_mappings = models.JSONField(default=dict, encoder=DjangoJSONEncoder)
    transformation_rules = models.JSONField(default=dict, encoder=DjangoJSONEncoder)
    
    # Filters and conditions
    sync_conditions = models.JSONField(default=dict, encoder=DjangoJSONEncoder)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ['name', 'external_system']
    
    def __str__(self):
        return f"{self.name} ({self.external_system})"