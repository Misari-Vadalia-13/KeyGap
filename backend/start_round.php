<?php
require 'db.php';

$texts = [
    "The quick brown fox jumps over the lazy dog.",
    "Pack my box with five dozen liquor jugs.",
    "How vexingly quick daft zebras jump!",
    "Sphinx of black quartz, judge my vow.",
    "Two driven jocks help fax my big quiz.",
    "A wizard's job is to vex chumps quickly in fog.",
    "Watch Jeopardy, Alex Trebek's fun TV quiz game.",
    "By Jove, my quick study of lexicography won a prize!"
];

$text = $texts[array_rand($texts)];
$round_id = bin2hex(random_bytes(16));

$stmt = $pdo->prepare("INSERT INTO rounds (id, text_content) VALUES (?, ?)");
$stmt->execute([$round_id, $text]);

echo json_encode([
    "round_id" => $round_id,
    "text" => $text
]);
?>
