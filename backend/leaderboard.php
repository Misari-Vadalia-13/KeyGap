<?php
require 'db.php';

$stmt = $pdo->query("SELECT username, wpm, accuracy, created_at FROM scores ORDER BY wpm DESC, accuracy DESC LIMIT 10");
$scores = $stmt->fetchAll();

echo json_encode($scores);
?>
