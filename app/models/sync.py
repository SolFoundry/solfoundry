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
    last_updated = models.DateTimeField(auto_now=True)
    
    # Generic foreign key to sync any model
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Sync metadata
    github_repo = models.CharField(max_length=255)
    github_ref = models.CharField(max_length=255, default='main')
    github_sha = models.CharField(max_length=40, null=True, blank=True)
    platform_version = models.CharField(max_length=50, null=True, blank=True)
    
    # Progress tracking
    total_items = models.PositiveIntegerField(default=0)
    completed_items = models.PositiveIntegerField(default=0)
    failed_items = models.PositiveIntegerField(default=0)
    
    # Error tracking
    error_message = models.TextField(null=True, blank=True)
    error_details = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    
    # User tracking
    initiated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        db_table = 'sync_status'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['status', 'sync_type']),
            models.Index(fields=['github_repo', 'github_ref']),
            models.Index(fields=['content_type', 'object_id']),
        ]
    
    def __str__(self):
        return f"{self.sync_type} - {self.status} ({self.github_repo})"
    
    @property
    def progress_percentage(self):
        if self.total_items == 0:
            return 0
        return (self.completed_items / self.total_items) * 100
    
    def mark_completed(self):
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_at'])
    
    def mark_failed(self, error_message=None, error_details=None):
        self.status = 'failed'
        self.completed_at = timezone.now()
        if error_message:
            self.error_message = error_message
        if error_details:
            self.error_details = error_details
        self.save(update_fields=['status', 'completed_at', 'error_message', 'error_details'])


class SyncRetryQueue(models.Model):
    RETRY_REASONS = [
        ('network_error', 'Network Error'),
        ('rate_limit', 'Rate Limit'),
        ('github_api_error', 'GitHub API Error'),
        ('validation_error', 'Validation Error'),
        ('conflict_error', 'Conflict Error'),
        ('permission_error', 'Permission Error'),
        ('unknown_error', 'Unknown Error'),
    ]
    
    sync_status = models.ForeignKey(SyncStatus, on_delete=models.CASCADE, related_name='retry_queue')
    
    # Retry configuration
    retry_count = models.PositiveIntegerField(default=0)
    max_retries = models.PositiveIntegerField(default=3)
    next_retry_at = models.DateTimeField()
    retry_interval = models.DurationField()  # Exponential backoff
    
    # Failure tracking
    failure_reason = models.CharField(max_length=20, choices=RETRY_REASONS)
    last_error = models.TextField()
    error_history = models.JSONField(default=list, encoder=DjangoJSONEncoder)
    
    # Item specifics
    item_type = models.CharField(max_length=100)  # e.g., 'issue', 'pull_request', 'comment'
    item_identifier = models.CharField(max_length=255)  # GitHub ID or platform ID
    sync_direction = models.CharField(max_length=20, choices=SyncStatus.SYNC_TYPES)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    payload = models.JSONField(encoder=DjangoJSONEncoder)
    
    class Meta:
        db_table = 'sync_retry_queue'
        ordering = ['next_retry_at']
        indexes = [
            models.Index(fields=['next_retry_at', 'retry_count']),
            models.Index(fields=['sync_status', 'failure_reason']),
        ]
    
    def __str__(self):
        return f"Retry {self.retry_count}/{self.max_retries} - {self.item_type}:{self.item_identifier}"
    
    def can_retry(self):
        return self.retry_count < self.max_retries and timezone.now() >= self.next_retry_at
    
    def schedule_retry(self, error_message=None):
        self.retry_count += 1
        self.last_attempt_at = timezone.now()
        
        # Exponential backoff
        base_interval = self.retry_interval.total_seconds()
        next_interval = base_interval * (2 ** (self.retry_count - 1))
        self.next_retry_at = timezone.now() + timezone.timedelta(seconds=next_interval)
        
        # Track error history
        if error_message:
            self.last_error = error_message
            self.error_history.append({
                'attempt': self.retry_count,
                'error': error_message,
                'timestamp': timezone.now().isoformat()
            })
        
        self.save()


class SyncConflict(models.Model):
    CONFLICT_TYPES = [
        ('content_mismatch', 'Content Mismatch'),
        ('concurrent_update', 'Concurrent Update'),
        ('schema_conflict', 'Schema Conflict'),
        ('permission_conflict', 'Permission Conflict'),
        ('status_conflict', 'Status Conflict'),
        ('metadata_conflict', 'Metadata Conflict'),
    ]
    
    RESOLUTION_STRATEGIES = [
        ('manual', 'Manual Resolution Required'),
        ('github_wins', 'GitHub Version Wins'),
        ('platform_wins', 'Platform Version Wins'),
        ('merge_changes', 'Merge Changes'),
        ('create_duplicate', 'Create Duplicate'),
        ('skip_item', 'Skip Item'),
    ]
    
    RESOLUTION_STATUS = [
        ('pending', 'Pending Resolution'),
        ('in_progress', 'Resolution In Progress'),
        ('resolved', 'Resolved'),
        ('abandoned', 'Abandoned'),
    ]
    
    sync_status = models.ForeignKey(SyncStatus, on_delete=models.CASCADE, related_name='conflicts')
    
    # Conflict identification
    conflict_type = models.CharField(max_length=20, choices=CONFLICT_TYPES)
    item_type = models.CharField(max_length=100)
    github_item_id = models.CharField(max_length=255)
    platform_item_id = models.CharField(max_length=255, null=True, blank=True)
    
    # Conflict data
    github_data = models.JSONField(encoder=DjangoJSONEncoder)
    platform_data = models.JSONField(encoder=DjangoJSONEncoder)
    conflict_fields = models.JSONField(default=list, encoder=DjangoJSONEncoder)
    
    # Resolution
    resolution_strategy = models.CharField(max_length=20, choices=RESOLUTION_STRATEGIES, default='manual')
    resolution_status = models.CharField(max_length=15, choices=RESOLUTION_STATUS, default='pending')
    resolved_data = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    resolution_notes = models.TextField(null=True, blank=True)
    
    # Tracking
    detected_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Metadata
    github_updated_at = models.DateTimeField()
    platform_updated_at = models.DateTimeField()
    conflict_hash = models.CharField(max_length=64)  # For deduplication
    
    class Meta:
        db_table = 'sync_conflicts'
        ordering = ['-detected_at']
        unique_together = ['sync_status', 'conflict_hash']
        indexes = [
            models.Index(fields=['resolution_status', 'conflict_type']),
            models.Index(fields=['sync_status', 'item_type']),
            models.Index(fields=['github_item_id', 'platform_item_id']),
        ]
    
    def __str__(self):
        return f"{self.conflict_type} - {self.item_type}:{self.github_item_id}"
    
    def mark_resolved(self, user=None, resolution_notes=None, resolved_data=None):
        self.resolution_status = 'resolved'
        self.resolved_at = timezone.now()
        self.resolved_by = user
        if resolution_notes:
            self.resolution_notes = resolution_notes
        if resolved_data:
            self.resolved_data = resolved_data
        self.save()
    
    def get_conflict_summary(self):
        """Generate a human-readable summary of the conflict"""
        summary = {
            'type': self.get_conflict_type_display(),
            'item': f"{self.item_type} (GitHub: {self.github_item_id})",
            'fields_affected': self.conflict_fields,
            'github_last_updated': self.github_updated_at,
            'platform_last_updated': self.platform_updated_at,
        }
        return summary


class SyncMapping(models.Model):
    """Maps GitHub items to platform items for bidirectional sync"""
    
    # GitHub identifiers
    github_repo = models.CharField(max_length=255)
    github_item_type = models.CharField(max_length=50)  # issue, pull_request, comment, etc.
    github_item_id = models.CharField(max_length=255)
    github_node_id = models.CharField(max_length=255, null=True, blank=True)
    
    # Platform identifiers
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    platform_object = GenericForeignKey('content_type', 'object_id')
    
    # Sync metadata
    created_at = models.DateTimeField(auto_now_add=True)
    last_synced_at = models.DateTimeField(auto_now=True)
    github_updated_at = models.DateTimeField()
    platform_updated_at = models.DateTimeField()
    
    # Sync state
    is_active = models.BooleanField(default=True)
    sync_direction = models.CharField(max_length=20, choices=SyncStatus.SYNC_TYPES, default='bidirectional')
    
    class Meta:
        db_table = 'sync_mappings'
        unique_together = [
            ['github_repo', 'github_item_type', 'github_item_id'],
            ['content_type', 'object_id'],
        ]
        indexes = [
            models.Index(fields=['github_repo', 'github_item_type']),
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['last_synced_at', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.github_repo}:{self.github_item_type}:{self.github_item_id} <-> {self.content_type}:{self.object_id}"