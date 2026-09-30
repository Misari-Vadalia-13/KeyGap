<?php
require 'db.php';

$data = json_decode(file_get_contents("php://input"), true);
if (!$data || !isset($data['round_id'], $data['username'], $data['log'])) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid payload"]);
    exit;
}

$round_id = $data['round_id'];
$username = trim(substr($data['username'], 0, 50));
$log = $data['log'];

if (empty($username)) {
    $username = "Anonymous";
}

$username = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');

// Verify round
$stmt = $pdo->prepare("SELECT text_content, created_at FROM rounds WHERE id = ?");
$stmt->execute([$round_id]);
$round = $stmt->fetch();

if (!$round) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid or expired round"]);
    exit;
}

// Security: Check expiry (e.g. 10 minutes)
$created_time = strtotime($round['created_at']);
if (time() - $created_time > 600) {
    http_response_code(400);
    echo json_encode(["error" => "Round expired"]);
    exit;
}

// Replay log
$expectedText = $round['text_content'];
$totalExpected = strlen($expectedText);
$correctHits = 0;
$totalHits = count($log);

if ($totalHits == 0) {
    http_response_code(400);
    echo json_encode(["error" => "Empty log"]);
    exit;
}

$startTime = $log[0]['time'];
$endTime = $log[count($log) - 1]['time'];
$durationMs = $endTime - $startTime;
$durationMin = $durationMs / 60000;

if ($durationMin <= 0) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid duration"]);
    exit;
}

$activeExpectedIndex = 0;
foreach ($log as $entry) {
    if ($activeExpectedIndex >= $totalExpected) break;
    $key = $entry['key'];
    
    if ($key === 'Backspace') {
        if ($activeExpectedIndex > 0) $activeExpectedIndex--;
        continue;
    }
    
    if ($key === $expectedText[$activeExpectedIndex]) {
        $correctHits++;
    }
    $activeExpectedIndex++;
}

// Recompute WPM
$wpm = round(($correctHits / 5) / $durationMin);
$accuracy = round(($correctHits / $totalHits) * 100);

if ($wpm > 300) {
    http_response_code(400);
    echo json_encode(["error" => "WPM too high. Bot detected."]);
    exit;
}

// Check for uniform timing (bot detection)
$isUniform = true;
if (count($log) > 2) {
    $firstInterval = $log[1]['time'] - $log[0]['time'];
    for ($i = 2; $i < count($log); $i++) {
        $interval = $log[$i]['time'] - $log[$i-1]['time'];
        if (abs($interval - $firstInterval) > 5) { // If intervals differ by more than 5ms
            $isUniform = false;
            break;
        }
    }
}
if ($isUniform && count($log) > 10) {
    http_response_code(400);
    echo json_encode(["error" => "Uniform typing detected. Bot detected."]);
    exit;
}

// Insert score
$stmt = $pdo->prepare("INSERT INTO scores (username, wpm, accuracy, duration) VALUES (?, ?, ?, ?)");
$stmt->execute([$username, $wpm, $accuracy, round($durationMs / 1000)]);

// Delete round so it can't be reused
$stmt = $pdo->prepare("DELETE FROM rounds WHERE id = ?");
$stmt->execute([$round_id]);

echo json_encode(["status" => "success", "wpm" => $wpm, "accuracy" => $accuracy]);
?>
