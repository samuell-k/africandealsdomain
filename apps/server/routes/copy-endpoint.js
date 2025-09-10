// POST /api/admin/files/:id/copy - Copy file or folder
router.post('/files/:id/copy', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { destination } = req.body;

    if (!destination) {
        return res.status(400).json({
            success: false,
            message: 'Destination path is required'
        });
    }

    res.json({
        success: true,
        message: 'File copied successfully',
        file: {
            id: parseInt(id),
            new_path: destination,
            copied_at: new Date().toISOString(),
            copied_by: req.user.id
        }
    });
}));