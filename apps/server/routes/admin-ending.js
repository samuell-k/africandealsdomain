            updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            created_by: 1,
            usage_count: 1250,
            open_rate: 75.5,
            click_rate: 23.4
        }
    ];

    res.json({
        success: true,
        message: 'Email templates retrieved successfully',
        templates: mockTemplates,
        stats: {
            total_templates: mockTemplates.length,
            active_templates: mockTemplates.filter(t => t.status === 'active').length,
            draft_templates: mockTemplates.filter(t => t.status === 'draft').length
        }
    });
}));

console.log('✅ [ADMIN ROUTER] Admin routes loaded successfully');

module.exports = router;